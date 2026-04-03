// ==========================================
// 0. CONFIGURATION & VERSION
// ==========================================
const APP_JS_VERSION = "1.3.2"; 
let db;
let chart;
let alimentSelectionne = null;

// Configuration des anneaux (3 actifs par défaut)
let configNutri = [
    { id: 'proteines', label: 'Prot.', color: '#38b2ac', target: 50 },
    { id: 'sel', label: 'Sel', color: '#ed8936', target: 5 },
    { id: 'sucres', label: 'Sucres', color: '#4299e1', target: 50 }
];

// ==========================================
// 1. INITIALISATION BASE DE DONNÉES
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
    if (document.getElementById('app-version')) {
        document.getElementById('app-version').innerText = `JS:${APP_JS_VERSION}`;
    }
};

// ==========================================
// 2. NAVIGATION ET INTERFACE
// ==========================================
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('overlay');
    const isVisible = sb.style.left === "0px";
    sb.style.left = isVisible ? "-290px" : "0px";
    ov.style.display = isVisible ? "none" : "block";
}

function showView(viewName) {
    document.getElementById('dash-view').style.display = (viewName === 'dash') ? 'block' : 'none';
    document.getElementById('search-section').style.display = (viewName === 'search') ? 'block' : 'none';
    
    document.getElementById('nav-dash').classList.toggle('active', viewName === 'dash');
    document.getElementById('nav-search').classList.toggle('active', viewName === 'search');
    
    if(viewName === 'dash') chargerAlimentsFavoris();
    if (document.getElementById('sidebar').style.left === "0px") toggleSidebar();
}

async function forceUpdate() {
    if ('serviceWorker' in navigator) {
        if(!confirm("Mettre à jour l'application ?")) return;
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let r of regs) { await r.unregister(); }
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        window.location.href = window.location.origin + window.location.pathname + '?rev=' + Date.now();
    }
}

// ==========================================
// 3. LOGIQUE DES ANNEAUX (CHIPS)
// ==========================================
function selectNutri(btn, id, label, color, target) {
    const isActive = btn.classList.contains('active');
    
    if (isActive) {
        if (configNutri.length <= 1) return;
        configNutri = configNutri.filter(n => n.id !== id);
        btn.classList.remove('active');
    } else {
        if (configNutri.length >= 3) {
            alert("Maximum 3 anneaux pour garder une bonne lisibilité.");
            return;
        }
        configNutri.push({ id, label, color, target });
        btn.classList.add('active');
    }

    // Rafraîchissement immédiat
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
// 4. RECHERCHE ET ALIMENTS
// ==========================================
async function rechercherAliment() {
    const input = document.getElementById('search-input');
    const resDiv = document.getElementById('search-results');
    const query = input.value.trim();
    
    if (query.length < 3) return alert("3 lettres minimum");
    resDiv.innerHTML = "<p style='text-align:center;'>🔍 Recherche...</p>";
    input.blur();

    try {
        const r = await fetch(`https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=15`);
        const d = await r.json();
        resDiv.innerHTML = "";
        
        d.products.forEach(p => {
            const n = p.nutriments;
            const score = p.nutriscore_grade || 'unknown';
            const name = (p.product_name_fr || p.product_name || "Inconnu").replace(/'/g, " ");
            
            resDiv.innerHTML += `
                <div style="display:flex; align-items:center; background:white; padding:12px; border-radius:18px; margin-bottom:10px; border:1px solid #edf2f7;">
                    <img src="${p.image_front_small_url || 'https://via.placeholder.com/50'}" style="width:50px; height:50px; border-radius:10px; object-fit:cover;">
                    <div style="flex:1; margin-left:12px;">
                        <strong style="font-size:0.85rem; display:block;">${name}</strong>
                        <span style="background:${getNutriColor(score)}; color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">${score.toUpperCase()}</span>
                    </div>
                    <button onclick="sauverAliment('${p.code}', '${name}', ${Math.round(n['energy-kcal_100g'] || 0)}, ${n.proteins_100g || 0}, ${n.salt_100g || 0}, ${n.sugars_100g || 0}, ${n.fat_100g || 0}, ${n.carbohydrates_100g || 0}, ${n.fiber_100g || 0}, '${score}')" style="background:var(--prim); color:white; border:none; width:38px; height:38px; border-radius:12px; font-weight:bold;">+</button>
                </div>`;
        });
    } catch(e) { resDiv.innerHTML = "Erreur de connexion"; }
}

function sauverAliment(id, nom, kcal, prot, sel, sucre, lip, gluc, fib, score) {
    const tx = db.transaction("aliments", "readwrite");
    tx.objectStore("aliments").put({ 
        id, nom, kcal, proteines: prot, sel, sucres: sucre, lipides: lip, glucides: gluc, fibres: fib, score, date: new Date().toISOString() 
    });
    tx.oncomplete = () => { 
        alert("Ajouté !");
        showView('dash'); 
    };
}

function supprimerAlimentLocal(id) {
    if (!confirm("Supprimer cet aliment ?")) return;
    db.transaction(["aliments"], "readwrite").objectStore("aliments").delete(id).onsuccess = () => chargerAlimentsFavoris();
}

// ==========================================
// 5. DASHBOARD & GRAPHIQUE
// ==========================================
function animerDisque(a) {
    alimentSelectionne = a;
    const scoreColor = getNutriColor(a.score);
    
    const series = configNutri.map(conf => {
        const valeur = a[conf.id] || 0;
        return Math.round(Math.min((valeur / conf.target) * 100, 100));
    });

    chart.updateOptions({
        colors: configNutri.map(n => n.color),
        labels: configNutri.map(n => n.label),
        plotOptions: { radialBar: { dataLabels: { total: { 
            show: true, 
            label: a.score.toUpperCase(), 
            color: scoreColor, 
            formatter: () => (a.kcal || 0) + ' kcal' 
        }}}},
        series: series
    }, false, true);
}

function chargerAlimentsFavoris() {
    if (!db) return;
    const store = db.transaction("aliments", "readonly").objectStore("aliments");
    store.getAll().onsuccess = (e) => {
        const alims = e.target.result;
        let html = '<h3 style="margin-top:25px; font-size:1.1rem;">Derniers ajouts</h3>';
        [...alims].reverse().slice(0, 10).forEach(a => {
            html += `
                <div onclick='animerDisque(${JSON.stringify(a)})' style="background:white; padding:15px; border-radius:18px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid #f7fafc; cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:14px; height:14px; border-radius:50%; background:${getNutriColor(a.score)}"></div>
                        <span style="font-weight:600; font-size:0.9rem;">${a.nom}</span>
                    </div>
                    <button onclick="event.stopPropagation(); supprimerAlimentLocal('${a.id}')" style="background:none; border:none; font-size:1.2rem; opacity:0.3;">🗑️</button>
                </div>`;
        });
        document.getElementById('ma-liste').innerHTML = html || "<p style='color:#a0aec0; text-align:center;'>Aucun aliment enregistré.</p>";
    };
}

function getNutriColor(g) {
    const colors = {a:'#038141', b:'#85BB2F', c:'#FECB02', d:'#EE8100', e:'#E63E11'};
    return colors[g?.toLowerCase()] || '#cbd5e0';
}

// ==========================================
// 6. INITIALISATION APEXCHARTS
// ==========================================
const options = {
    series: [0, 0, 0],
    chart: { height: 380, type: 'radialBar' },
    colors: configNutri.map(n => n.color),
    labels: configNutri.map(n => n.label),
    plotOptions: { 
        radialBar: { 
            hollow: { size: '62%' }, 
            track: { margin: 7, background: '#f8f9fa' },
            dataLabels: { 
                name: { show: true, fontSize: '80px', fontWeight: '900', offsetY: -15 },
                value: { show: true, fontSize: '24px', fontWeight: '600', color: '#718096', offsetY: 25 },
                total: { show: true, label: '-', color: '#cbd5e0', formatter: () => '0 kcal' }
            }
        } 
    },
    stroke: { lineCap: 'round', width: 18 }
};

chart = new ApexCharts(document.querySelector("#pantry-chart"), options);
chart.render();
            
