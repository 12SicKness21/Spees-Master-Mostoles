/**
 * Configuración centralizada de Firebase para Tienda Speed Master
 */

const firebaseConfig = {
    apiKey: "AIzaSyAwi-o_Syua5z_N7OAvJjZwnWgxIE5_IrA",
    authDomain: "speed-master-mostoles.firebaseapp.com",
    projectId: "speed-master-mostoles",
    storageBucket: "speed-master-mostoles.firebasestorage.app",
    messagingSenderId: "908113080786",
    appId: "1:908113080786:web:0e79c81f62cc9c2ccfd80b",
    measurementId: "G-V16LW826TS"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Exportar instancias para uso global
const auth = firebase.auth();
const db = firebase.firestore();

// Habilitar persistencia de datos offline para mejorar la experiencia sin conexión
db.enablePersistence({ synchronizeTabs: true })
    .catch(err => {
        if (err.code === 'failed-precondition') {
            console.warn("Persistencia de datos: Múltiples pestañas abiertas (Firestore solo soporta una pestaña con persistencia al mismo tiempo).");
        } else if (err.code === 'unimplemented') {
            console.warn("Persistencia de datos: El navegador no soporta esta característica.");
        }
    });
const remoteConfig = firebase.remoteConfig();

// Configuración de Remote Config
remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 hora
remoteConfig.defaultConfig = {
    max_dispositivos: 2
};

// Intentar actualizar valores
remoteConfig.fetchAndActivate()
    .catch(err => console.error("Remote Config no pudo cargar:", err));

// Persistencia de sesión
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

/**
 * Gestión de Sesiones por Dispositivo
 */

function getDeviceId() {
    let id = localStorage.getItem('repara_shisha_device_id');
    if (!id) {
        id = 'dev_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        localStorage.setItem('repara_shisha_device_id', id);
    }
    return id;
}

async function validateAndSyncSession(user) {
    if (!user) return;

    const deviceId = getDeviceId();
    const sessionRef = db.collection('sessions').doc(user.uid);

    // Obtener límite de Remote Config (parámetro max_dispositivos)
    const maxSessions = remoteConfig.getNumber('max_dispositivos') || 2;

    try {
        // Si el cliente está offline, no podemos validar con el servidor.
        // Permitimos el acceso ya que la autenticación de Firebase ya validó al usuario localmente.
        if (!navigator.onLine) {
            console.log("Cliente offline: se permite el acceso sin validación de dispositivo.");
            return true;
        }

        const doc = await sessionRef.get();
        let sessions = doc.exists ? doc.data() : { devices: {} };

        // Si el dispositivo ya está registrado, solo actualizamos timestamp
        if (sessions.devices && sessions.devices[deviceId]) {
            sessions.devices[deviceId] = Date.now();
            await sessionRef.set(sessions, { merge: true });
            return true;
        }

        // Si es un nuevo dispositivo, comprobamos el límite
        const activeDevices = Object.keys(sessions.devices || {}).filter(id => {
            // Consideramos activo si se actualizó en las últimas 24 horas
            return (Date.now() - sessions.devices[id]) < (24 * 60 * 60 * 1000);
        });

        if (activeDevices.length >= maxSessions) {
            throw new Error(`Has alcanzado el límite de ${maxSessions} dispositivos conectados. Cierra sesión en otro dispositivo para entrar aquí. Puedes escribir al +34 600854768`);
        }

        // Registrar nuevo dispositivo
        if (!sessions.devices) sessions.devices = {};
        sessions.devices[deviceId] = Date.now();
        await sessionRef.set(sessions, { merge: true });
        return true;

    } catch (error) {
        // Manejar específicamente el error de desconexión por si falló durante el 'get'
        if (error.code === 'unavailable' || error.message.includes('offline')) {
            console.warn("Fallo validación de sesión por falta de conexión. Permitiendo acceso temporal.");
            return true;
        }
        
        console.error("Error en validación de sesión:", error);
        throw error;
    }
}

async function removeSession(uid) {
    const deviceId = getDeviceId();
    try {
        const update = {};
        update[`devices.${deviceId}`] = firebase.firestore.FieldValue.delete();
        await db.collection('sessions').doc(uid).update(update);
    } catch (e) {
        console.error("Error removiendo sesión:", e);
    }
}
