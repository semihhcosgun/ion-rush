const svg=(body:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const icons={
 laneLeft:svg('<path d="m18 5-7 7 7 7"/><path d="m11 5-7 7 7 7"/>'),
 laneRight:svg('<path d="m6 5 7 7-7 7"/><path d="m13 5 7 7-7 7"/>'),
 surfaceLeft:svg('<path d="M7 8H3V4m0 4a9 9 0 1 1 1 10"/><path d="m12 8 4 4-4 4-4-4 4-4Z"/>'),
 surfaceRight:svg('<path d="M17 8h4V4m0 4a9 9 0 1 0-1 10"/><path d="m12 8 4 4-4 4-4-4 4-4Z"/>'),
 fire:svg('<path d="M9 4H4v5m11-5h5v5m0 6v5h-5M9 20H4v-5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 6.5v2m0 7v2m-5.5-5.5h2m7 0h2"/><path d="m12 10 2 2-2 2-2-2 2-2Z" fill="currentColor" stroke="none"/>'),
 turboControl:svg('<path d="M9 3h6l2 9H7l2-9Z" fill="currentColor" fill-opacity=".18"/><path d="M9 3h6M8 6h8M7 12h10l1 3H6l1-3Z"/><path d="M9 17v3m3-3v5m3-5v3" stroke-width="2"/><path d="M12 6v3" stroke-width="1.3"/>'),
 turbo:svg('<path d="m13.5 4.5 5.5 7.5-5.5 7.5H9l5-7.5-5-7.5h4.5Z"/><path d="M7.5 8H4m4 4H2m5.5 4H4"/>'),
 energy:svg('<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><path d="M7.3 5.5A8.2 8.2 0 0 1 19.7 9M16.7 18.5A8.2 8.2 0 0 1 4.3 15"/><path d="m18.8 5.7.9 3.3-3.3.8M5.2 18.3 4.3 15l3.3-.8"/>'),
 exit:svg('<path d="M12 3v8"/><path d="M6.4 6.4a8 8 0 1 0 11.2 0"/>'),
 pause:svg('<path d="M8 6v12m8-12v12" stroke-width="3"/>'),
 close:svg('<path d="m6 6 12 12M18 6 6 18"/>'),
};
