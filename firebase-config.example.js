/**
 * Plantilla de configuración de Firebase para Tienda Speed Master
 *
 * INSTRUCCIONES:
 * 1. Copia este archivo y renómbralo a: firebase-config.js
 * 2. Rellena los valores con los de tu proyecto en https://console.firebase.google.com
 * 3. NUNCA subas firebase-config.js al repositorio (ya está en .gitignore)
 */

const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROJECT_ID.firebaseapp.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID",
    measurementId: "TU_MEASUREMENT_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Exportar instancias para uso global
const auth = firebase.auth();
const db = firebase.firestore();
