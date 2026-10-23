package com.example.ionrush;

import android.content.Context;
import android.content.SharedPreferences;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name="IonBilling")
public class IonBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private static final String PREFS="ion-billing-v1";
    private static final String LEDGER="pending-grants";
    private static final List<String> PRODUCT_ORDER=Arrays.asList("example_nova_5","example_nova_15","example_nova_40");
    private static final Map<String,Integer> NOVA_BY_PRODUCT=new HashMap<>();
    static {
        NOVA_BY_PRODUCT.put("example_nova_5",5);
        NOVA_BY_PRODUCT.put("example_nova_15",15);
        NOVA_BY_PRODUCT.put("example_nova_40",40);
    }

    private BillingClient billingClient;
    private boolean connecting=false;
    private final List<Runnable> connectionReady=new ArrayList<>();
    private final List<Runnable> connectionFailed=new ArrayList<>();
    private final Map<String,ProductDetails> detailsById=new HashMap<>();
    private PluginCall activePurchaseCall;

    @Override public void load() {
        billingClient=BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    private void connect(Runnable ready,Runnable failed) {
        synchronized(this) {
            if(billingClient!=null&&billingClient.isReady()){ready.run();return;}
            connectionReady.add(ready);
            connectionFailed.add(failed);
            if(connecting)return;
            connecting=true;
        }
        billingClient.startConnection(new BillingClientStateListener(){
            @Override public void onBillingSetupFinished(BillingResult result){
                List<Runnable> callbacks;
                synchronized(IonBillingPlugin.this){
                    connecting=false;
                    boolean ok=result.getResponseCode()==BillingClient.BillingResponseCode.OK;
                    callbacks=new ArrayList<>(ok?connectionReady:connectionFailed);
                    connectionReady.clear();connectionFailed.clear();
                }
                callbacks.forEach(Runnable::run);
            }
            @Override public void onBillingServiceDisconnected(){synchronized(IonBillingPlugin.this){connecting=false;}}
        });
    }

    @PluginMethod public void initialize(PluginCall call){
        connect(()->queryProducts(()->syncPurchases(()->call.resolve(statusObject(null)))),()->call.resolve(statusObject("service_unavailable")));
    }

    @PluginMethod public void products(PluginCall call){
        connect(()->queryProducts(()->call.resolve(statusObject(null))),()->call.resolve(statusObject("service_unavailable")));
    }

    private void queryProducts(Runnable done){
        List<QueryProductDetailsParams.Product> products=new ArrayList<>();
        for(String id:PRODUCT_ORDER)products.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
        QueryProductDetailsParams params=QueryProductDetailsParams.newBuilder().setProductList(products).build();
        billingClient.queryProductDetailsAsync(params,(result,queryResult)->{
            synchronized(detailsById){
                detailsById.clear();
                if(result.getResponseCode()==BillingClient.BillingResponseCode.OK){
                    for(ProductDetails details:queryResult.getProductDetailsList())detailsById.put(details.getProductId(),details);
                }
            }
            done.run();
        });
    }

    private ProductDetails.OneTimePurchaseOfferDetails offer(ProductDetails details){
        List<ProductDetails.OneTimePurchaseOfferDetails> offers=details.getOneTimePurchaseOfferDetailsList();
        return offers==null||offers.isEmpty()?null:offers.get(0);
    }

    private JSObject statusObject(String reason){
        JSObject result=new JSObject();
        boolean ready=billingClient!=null&&billingClient.isReady();
        result.put("configured",true);
        result.put("ready",ready&&!detailsById.isEmpty());
        if(reason!=null)result.put("reason",reason);
        JSArray products=new JSArray();
        synchronized(detailsById){
            for(String id:PRODUCT_ORDER){
                JSObject item=new JSObject();
                ProductDetails details=detailsById.get(id);
                ProductDetails.OneTimePurchaseOfferDetails offer=details==null?null:offer(details);
                item.put("id",id);item.put("nova",NOVA_BY_PRODUCT.get(id));item.put("available",offer!=null);item.put("price",offer==null?"—":offer.getFormattedPrice());
                products.put(item);
            }
        }
        result.put("products",products);
        return result;
    }

    @PluginMethod public void purchase(PluginCall call){
        String productId=call.getString("productId","");
        if(!NOVA_BY_PRODUCT.containsKey(productId)){resolvePurchase(call,false,false,"unknown_product");return;}
        connect(()->launchPurchase(call,productId),()->resolvePurchase(call,false,false,"service_unavailable"));
    }

    private void launchPurchase(PluginCall call,String productId){
        synchronized(this){
            if(activePurchaseCall!=null){resolvePurchase(call,false,false,"purchase_in_progress");return;}
        }
        ProductDetails details;
        synchronized(detailsById){details=detailsById.get(productId);}
        if(details==null){queryProducts(()->launchPurchase(call,productId));return;}
        ProductDetails.OneTimePurchaseOfferDetails offer=offer(details);
        if(offer==null){resolvePurchase(call,false,false,"product_unavailable");return;}
        BillingFlowParams.ProductDetailsParams productParams=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).setOfferToken(offer.getOfferToken()).build();
        BillingFlowParams flowParams=BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(productParams)).setIsOfferPersonalized(false).build();
        synchronized(this){activePurchaseCall=call;}
        getActivity().runOnUiThread(()->{
            BillingResult result=billingClient.launchBillingFlow(getActivity(),flowParams);
            if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK)finishPurchase(false,false,responseReason(result));
        });
    }

    @Override public void onPurchasesUpdated(BillingResult result,List<Purchase> purchases){
        if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){finishPurchase(false,false,responseReason(result));return;}
        if(purchases==null||purchases.isEmpty()){finishPurchase(false,false,"empty_purchase");return;}
        Purchase purchase=purchases.get(0);
        if(purchase.getPurchaseState()==Purchase.PurchaseState.PENDING){finishPurchase(false,true,"pending");return;}
        if(purchase.getPurchaseState()!=Purchase.PurchaseState.PURCHASED){finishPurchase(false,false,"not_purchased");return;}
        processPurchase(purchase,true);
    }

    private void processPurchase(Purchase purchase,boolean reportToCaller){
        String productId=purchase.getProducts().stream().filter(NOVA_BY_PRODUCT::containsKey).findFirst().orElse(null);
        if(productId==null){if(reportToCaller)finishPurchase(false,false,"unknown_product");return;}
        recordGrant(purchase.getPurchaseToken(),productId,NOVA_BY_PRODUCT.get(productId));
        ConsumeParams params=ConsumeParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build();
        billingClient.consumeAsync(params,(result,token)->{
            if(reportToCaller)finishPurchase(true,false,result.getResponseCode()==BillingClient.BillingResponseCode.OK?null:"consumption_pending");
        });
    }

    @PluginMethod public void sync(PluginCall call){
        connect(()->syncPurchases(()->{JSObject result=new JSObject();result.put("synced",true);call.resolve(result);}),()->{JSObject result=new JSObject();result.put("synced",false);call.resolve(result);});
    }

    private void syncPurchases(Runnable done){
        QueryPurchasesParams params=QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build();
        billingClient.queryPurchasesAsync(params,(result,purchases)->{
            if(result.getResponseCode()==BillingClient.BillingResponseCode.OK){
                for(Purchase purchase:purchases)if(purchase.getPurchaseState()==Purchase.PurchaseState.PURCHASED)processPurchase(purchase,false);
            }
            done.run();
        });
    }

    private synchronized void finishPurchase(boolean purchased,boolean pending,String reason){
        PluginCall call=activePurchaseCall;
        activePurchaseCall=null;
        if(call!=null)resolvePurchase(call,purchased,pending,reason);
    }

    private void resolvePurchase(PluginCall call,boolean purchased,boolean pending,String reason){
        JSObject result=new JSObject();result.put("purchased",purchased);result.put("pending",pending);if(reason!=null)result.put("reason",reason);call.resolve(result);
    }

    private String responseReason(BillingResult result){
        if(result.getResponseCode()==BillingClient.BillingResponseCode.USER_CANCELED)return "cancelled";
        if(result.getResponseCode()==BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED)return "already_owned";
        if(result.getResponseCode()==BillingClient.BillingResponseCode.ITEM_UNAVAILABLE)return "product_unavailable";
        if(result.getResponseCode()==BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE)return "service_unavailable";
        if(result.getResponseCode()==BillingClient.BillingResponseCode.NETWORK_ERROR)return "network_error";
        return "billing_error_"+result.getResponseCode();
    }

    private SharedPreferences prefs(){return getContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);}

    private synchronized void recordGrant(String token,String productId,int nova){
        JSONObject ledger=readLedger();
        String id=tokenHash(token);
        if(ledger.has(id))return;
        try{
            JSONObject value=new JSONObject();value.put("productId",productId);value.put("nova",nova);ledger.put(id,value);
            prefs().edit().putString(LEDGER,ledger.toString()).commit();
        }catch(JSONException ignored){}
    }

    private JSONObject readLedger(){
        try{return new JSONObject(prefs().getString(LEDGER,"{}"));}catch(JSONException ignored){return new JSONObject();}
    }

    @PluginMethod public synchronized void claims(PluginCall call){
        JSONObject ledger=readLedger();JSArray claims=new JSArray();
        for(java.util.Iterator<String> it=ledger.keys();it.hasNext();){
            String id=it.next();JSONObject value=ledger.optJSONObject(id);if(value==null)continue;
            JSObject claim=new JSObject();claim.put("id",id);claim.put("productId",value.optString("productId"));claim.put("nova",value.optInt("nova"));claims.put(claim);
        }
        JSObject result=new JSObject();result.put("claims",claims);call.resolve(result);
    }

    @PluginMethod public synchronized void completeClaims(PluginCall call){
        JSArray ids=call.getArray("ids");JSONObject ledger=readLedger();int completed=0;
        if(ids!=null){
            try{for(Object value:ids.toList()){String id=String.valueOf(value);if(ledger.has(id)){ledger.remove(id);completed++;}}}catch(JSONException ignored){}
        }
        prefs().edit().putString(LEDGER,ledger.toString()).commit();
        JSObject result=new JSObject();result.put("completed",completed);call.resolve(result);
    }

    private String tokenHash(String token){
        try{
            byte[] bytes=MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();
            for(byte value:bytes)out.append(String.format("%02x",value));return out.toString();
        }catch(Exception ignored){return Integer.toHexString(token.hashCode());}
    }
}
