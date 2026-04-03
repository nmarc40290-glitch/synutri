
let db;
const request = indexedDB.open("SynutriDB", 1);

request.onupgradeneeded = (event) => {
    db = event.target.result;
    // On crée un magasin d'objets "aliments" avec l'ID (ou code-barres) comme clé
    if (!db.objectStoreNames.contains("aliments")) {
        db.createObjectStore("aliments", { keyPath: "id" });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log("Base de données Synutri prête !");
};


// Affiche la version depuis version.js
document.getElementById('app-version').innerText = VERSION;

// --- GRAPHIQUE ---
const chartOptions = {
    series: [65, 40, 20],
    chart: { height: 350, type: 'radialBar' },
    colors: ['#38b2ac', '#ed8936', '#4299e1'],
    labels: ['Protéines', 'Sel', 'Sucres'],
    plotOptions: {
        radialBar: { hollow: { size: '45%' }, track: { margin: 10 } }
    }
};
new ApexCharts(document.querySelector("#pantry-chart"), chartOptions).render();

// --- UI FUNCTIONS ---
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('overlay');
    const open = sb.style.left === "0px";
    sb.style.left = open ? "-290px" : "0px";
    ov.style.display = open ? "none" : "block";
}

function forceUpdate() {
    navigator.serviceWorker.getRegistrations().then(regs => {
        for(let r of regs) r.unregister();
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
        alert("Synutri va redémarrer pour la mise à jour.");
        window.location.reload(true);
    });
}

// --- PWA INSTALL ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-container').style.display = 'block';
});

document.getElementById('btn-install').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt = null;
        document.getElementById('install-container').style.display = 'none';
    }
});

// --- NAVIGATION ENTRE LES VUES ---
function showView(viewName) {
    const dash = document.querySelector('.container');
    const search = document.getElementById('search-section');
    const navItems = document.querySelectorAll('.nav-item');

    // On cache tout
    dash.style.display = 'none';
    search.style.display = 'none';
    navItems.forEach(item => item.classList.remove('active'));

    // On affiche la vue demandée
    if (viewName === 'dash') {
        dash.style.display = 'block';
        navItems[0].classList.add('active');
    } else if (viewName === 'search') {
        search.style.display = 'block';
        navItems[2].classList.add('active'); // L'item "Scanner"
    }
}

// Modifie tes liens dans le HTML pour appeler showView('dash') ou showView('search')
