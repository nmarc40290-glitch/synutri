 let objectifsUser = { proteines: 50, sel: 5, sucres: 50 };
let db;
let chart;

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
};

if (typeof VERSION !== 'undefined') {
    document.getElementById('app-version').innerText = VERSION;
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const open = sb.style.left === "0px";
    sb.style.left = open ? "-290px" : "0px";
    document.getElementById('overlay').style.display = open ? "none" : "block";
}

function showView(viewName) {
    document.getElementById('dash-view').style.display = (viewName === 'dash') ? 'block' : 'none';
    document.getElementById('search-section').style.display = (viewName === 'search') ? 'block' : 'none';
    if(viewName === 'dash') chargerAlimentsFavoris();
    if(document.getElementById('sidebar').style.left === "0px") toggleSidebar();
}

function getNutriColor(grade) {
    const colors = { 'a': '#038141', 'b': '#85BB2F', 'c': '#FECB02', 'd': '#EE8100', 'e': '#E63E11' };
    return colors[grade?.toLowerCase()] || '#cbd5e0';
}

function animerDisque(nom, kcal, prot, sucre, sel, score) {
    const pProt = Math.min((prot / objectifsUser.proteines) * 100, 100);
    const pSel = Math.min((sel / objectifsUser.sel) * 100, 100);
    const pSucre = Math.min((sucre / objectifsUser.sucres) * 100, 100);

    chart.updateOptions({
        plotOptions: {
            radialBar: {
                dataLabels: {
                    total: {
                        show: true,
                        label: nom.substring(0, 12) + (nom.length > 12 ? '..' : ''),
                        formatter: () => `${score.toUpperCase()} (${kcal} kcal)`,
                        color: getNutriColor(score)
                    }
                }
            }
        },
        series: [Math.round(pProt), Math.round(pSel), Math.round(pSucre)]
    });
}

async function rechercherAliment() {
    const query = document.getElementById('search-input').value;
    const resDiv = document.getElementById('search-results');
    if (query.length < 3) return;
    resDiv.innerHTML = "🔍...";
    try {
        const r = await fetch(`https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=15`);
        const d = await r.json();
        resDiv.innerHTML = "";
        d.products.forEach(p => {
            const name = (p.product_name_fr || p.product_name || "Inconnu").replace(/'/g, " ");
            const kcal = Math.round(p.nutriments['energy-kcal_100g'] || 0);
            const score = p.nutriscore_grade || 'unknown';
            const card = document.createElement('div');
            card.style = "display:flex; justify-content:space-between; padding:15px; background:white; margin-bottom:10px; border-radius:15px;";
            card.innerHTML = `
                <div><strong>${name}</strong><br><small>${kcal} kcal</small></div>
                <button onclick="ajouterAliment('${p.code}','${name}',${kcal},${p.nutriments.proteins_100g || 0},${p.nutriments.sugars_100g || 0},${p.nutriments.salt_100g || 0},'${score}')" style="background:#38b2ac; color:white; border:none; padding:10px; border-radius:10px;">+</button>
            `;
            resDiv.appendChild(card);
        });
    } catch (e) { resDiv.innerHTML = "Erreur réseau"; }
}

function ajouterAliment(id, nom, kcal, prot, sucre, sel, score) {
    const store = db.transaction("aliments", "readwrite").objectStore("aliments");
    store.put({ id, nom, calories: kcal, proteines: prot, sucres: sucre, sel: sel, score: score, dateAjout: new Date().toISOString() });
    alert("Ajouté !");
    showView('dash');
}

function chargerAlimentsFavoris() {
    if (!db) return;
    const store = db.transaction("aliments", "readonly").objectStore("aliments");
    store.getAll().onsuccess = (e) => {
        const alims = e.target.result;
        let html = '<h3 style="margin:20px 0 10px;">Derniers ajouts</h3>';
        alims.reverse().slice(0, 8).forEach(a => {
            html += `
                <div class="card" onclick="animerDisque('${a.nom.replace(/'/g, "\\'")}',${a.calories},${a.proteines},${a.sucres},${a.sel},'${a.score}')" 
                     style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:white; margin-bottom:8px; border-radius:15px; cursor:pointer; border:1px solid #edf2f7;">
                    <span>${a.nom}</span>
                    <button onclick="event.stopPropagation(); supprimerAliment('${a.id}')" style="background:none; border:none; color:red;">🗑️</button>
                </div>`;
        });
        document.getElementById('ma-liste').innerHTML = html;
    };
}

function supprimerAliment(id) {
    db.transaction("aliments", "readwrite").objectStore("aliments").delete(id).onsuccess = () => chargerAlimentsFavoris();
}

chart = new ApexCharts(document.querySelector("#pantry-chart"), {
    series: [0, 0, 0],
    chart: { height: 350, type: 'radialBar' },
    colors: ['#38b2ac', '#ed8936', '#4299e1'],
    labels: ['Protéines', 'Sel', 'Sucres'],
    plotOptions: { radialBar: { hollow: { size: '55%' }, dataLabels: { total: { show: true, label: 'Sélectionnez' } } } }
});
chart.render();

async function forceUpdate() {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (let r of regs) await r.unregister();
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    window.location.reload(true);
}
