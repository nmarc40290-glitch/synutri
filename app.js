// ==========================================
// 1. VARIABLES GLOBALES & CONFIGURATION
// ==========================================
const APP_JS_VERSION = "1.4.0"; 
let db;
let chart;
let alimentSelectionne = null;

// On garde les 3 catégories actives par défaut pour l'affichage initial
let configNutri = [
    { id: 'proteines', label: 'Prot.', color: '#38b2ac', target: 50 },
    { id: 'sel', label: 'Sel', color: '#ed8936', target: 5 },
    { id: 'sucres', label: 'Sucres', color: '#4299e1', target: 50 }
];

// ==========================================
// 2. INITIALISATION INDEXEDDB
// ==========================================
const request = indexedDB.open("SynutriDB", 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("aliments")) {
        db.createObjectStore("aliments", { keyPath: "id" });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    chargerAlimentsFavoris();
    // Applique les couleurs aux chips actives dès le démarrage
    colorierChipsInitiales();
    if (document.getElementById('app-version')) {
        document.getElementById('app-version').innerText = `v${APP_JS_VERSION}`;
    }
};

// ==========================================
// 3. LOGIQUE DES CHIPS (COULEURS DYNAMIQUES)
// ==========================================
function colorierChipsInitiales() {
    document.querySelectorAll('.chip.active').forEach(chip => {
        // On extrait la couleur de l'attribut onclick
        const match = chip.getAttribute('onclick').match(/'(#[0-9a-fA-F]{6})'/);
        if (match) chip.style.backgroundColor = match[1];
    });
}

function selectNutri(btn, id, label, color, target) {
    const isActive = btn.classList.contains('active');
    
    if (isActive) {
        if (configNutri.length <= 1) return;
        configNutri = configNutri.filter(n => n.id !== id);
        btn.classList.remove('active');
        btn.style.backgroundColor = "white";
        btn.style.color = "#718096";
    } else {
        if (configNutri.length >= 3) {
            alert("Maximum 3 anneaux affichés.");
            return;
        }
        configNutri.push({ id, label, color, target });
        btn.classList.add('active');
        btn.style.backgroundColor = color;
        btn.style.color = "white";
    }

    // Mise à jour graphique
    if (alimentSelectionne) {
        animerDisque(alimentSelectionne);
    } else {
        chart.updateOptions({ 
            colors: configNutri.map(n => n.color), 
            labels: configNutri.map(n => n.label) 
        });
    }
}

// ==========================================
// 4. RECHERCHE OPEN FOOD FACTS
// ==========================================
async function rechercherAliment() {
    const input = document.getElementById('search-input');
    const resDiv = document.getElementById('search-results');
    const query = input.value.trim();
    
    if (query.length < 3) return;
    resDiv.innerHTML = "<p style='text-align:center;'>🔍 Recherche...</p>";

    try {
        const response = await fetch(`https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=15`);
        const data = await response.json();
        resDiv.innerHTML = "";
        
        data.products.forEach(p => {
            const n = p.nutriments;
            const score = p.nutriscore_grade || 'unknown';
            const name = (p.product_name_fr || p.product_name || "Inconnu").replace(/'/g, " ");
            
            resDiv.innerHTML += `
                <div style="display:flex; align-items:center; background:white; padding:12px; border-radius:18px; margin-bottom:10px; border:1px solid #edf2f7;">
                    <img src="${p.image_front_small_url || ''}" style="width:50px; height:50px; border-radius:10px; object-fit:cover;">
                    <div style="flex:1; margin-left:12px;">
                        <strong style="font-size:0.85rem;">${name}</strong>
                        <span style="display:block; font-size:0.7rem; color:${getNutriColor(score)}">${score.toUpperCase()}</span>
                    </div>
                    <button onclick="sauverAliment('${p.code}', '${name}', ${Math.round(n['energy-kcal_100g'] || 0)}, ${n.proteins_100g || 0}, ${n.salt_100g || 0}, ${n.sugars_100g || 0}, ${n.fat_100g || 0}, ${n.carbohydrates_100g || 0}, ${n.fiber_100g || 0}, '${score}')" style="background:var(--prim); color:white; border:none; width:40px; height:40px; border-radius:12px;">+</button>
                </div>`;
        });
    } catch(e) { resDiv.innerHTML = "Erreur réseau."; }
}

function sauverAliment(id, nom, kcal, prot, sel, sucre, lip, gluc, fib, score) {
    const tx = db.transaction("aliments", "readwrite");
    tx.objectStore("aliments").put({ 
        id, nom, kcal, proteines: prot, sel, sucres: sucre, lipides: lip, glucides: gluc, fibres: fib, score, date: new Date().toISOString() 
    });
    tx.oncomplete = () => { showView('dash'); };
}

// ==========================================
// 5. GESTION DU DASHBOARD
// ==========================================
function chargerAlimentsFavoris() {
    if (!db) return;
    const store = db.transaction("aliments", "readonly").objectStore("aliments");
    store.getAll().onsuccess = (e) => {
        const alims = e.target.result;
        let html = '<h3 style="margin:25px 0 10px; font-size:1.1rem;">Derniers ajouts</h3>';
        [...alims].reverse().slice(0, 10).forEach(a => {
            html += `
                <div onclick='animerDisque(${JSON.stringify(a)})' style="background:white; padding:15px; border-radius:18px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid #f7fafc; cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:14px; height:14px; border-radius:50%; background:${getNutriColor(a.score)}"></div>
                        <span style="font-weight:600; font-size:0.9rem;">${a.nom}</span>
                    </div>
                    <button onclick="event.stopPropagation(); supprimerAliment('${a.id}')" style="background:none; border:none; opacity:0.2;">🗑️</button>
                </div>`;
        });
        document.getElementById('ma-liste').innerHTML = html;
    };
}

function supprimerAliment(id) {
    if (!confirm("Supprimer ?")) return;
    db.transaction("aliments", "readwrite").objectStore("aliments").delete(id).onsuccess = () => chargerAlimentsFavoris();
}

function animerDisque(a) {
    alimentSelectionne = a;
    const series = configNutri.map(conf => {
        const valeur = a[conf.id] || 0;
        return Math.round(Math.min((valeur / conf.target) * 100, 100));
    });

    chart.updateOptions({
        colors: configNutri.map(n => n.color),
        labels: configNutri.map(n => n.label),
        plotOptions: { radialBar: { dataLabels: { total: { 
            show: true, label: a.score.toUpperCase(), color: getNutriColor(a.score), formatter: () => (a.kcal || 0) + ' kcal' 
        }}}},
        series: series
    }, false, true);
}

// ==========================================
// 6. INITIALISATION GRAPHIQUE APEXCHARTS
// ==========================================
const options = {
    series: [0, 0, 0],
    chart: { height: 380, type: 'radialBar' },
    colors: configNutri.map(n => n.color),
    labels: configNutri.map(n => n.label),
    plotOptions: { 
        radialBar: { 
            hollow: { size: '62%' }, 
            track: { margin: 8, background: '#f2f2f2' },
            dataLabels: { 
                name: { show: true, fontSize: '80px', fontWeight: '900', offsetY: -15 },
                value: { show: true, fontSize: '24px', fontWeight: '600', color: '#718096', offsetY: 25 },
                total: { show: true, label: '-', color: '#cbd5e0', formatter: () => '0 kcal' }
            }
        } 
    },
    stroke: { lineCap: 'round', width: 20 }, // ÉPAISSEUR XXL
    legend: { show: false }
};

chart = new ApexCharts(document.querySelector("#pantry-chart"), options);
chart.render();

// ==========================================
// 7. FONCTIONS OUTILS (NAVIGATION)
// ==========================================
function getNutriColor(g) {
    const colors = {a:'#038141', b:'#85BB2F', c:'#FECB02', d:'#EE8100', e:'#E63E11'};
    return colors[g?.toLowerCase()] || '#cbd5e0';
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('overlay');
    const open = sb.style.left === "0px";
    sb.style.left = open ? "-290px" : "0px";
    ov.style.display = open ? "none" : "block";
}

function showView(v) {
    document.getElementById('dash-view').style.display = (v === 'dash') ? 'block' : 'none';
    document.getElementById('search-section').style.display = (v === 'search') ? 'block' : 'none';
    document.getElementById('nav-dash').classList.toggle('active', v === 'dash');
    document.getElementById('nav-search').classList.toggle('active', v === 'search');
    if(v === 'dash') chargerAlimentsFavoris();
    if(document.getElementById('sidebar').style.left === "0px") toggleSidebar();
}

async function forceUpdate() {
    if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for(let r of regs) { await r.unregister(); }
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        window.location.reload(true);
    }
}
