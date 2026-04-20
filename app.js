// ================= KHAI BÁO DỮ LIỆU =================
let allCustomers = [];
let markers = [];
let polylines = [];
let antPolylines = [];

let depot = {
    id: 0, name: "Depot", lat: 18.67, lng: 105.69
};

let vehicles = 3;
let Q = 30;

// Ma trận pheromone
let pheromone = {};

let mode = "view";

// ================= DỮ LIỆU MẪU (CVRP) =================
// Các điểm mẫu quanh depot (bạn có thể thay bằng dữ liệu thật)
const sampleCustomers = [
    { lat: 18.676, lng: 105.681, demand: 7 },
    { lat: 18.664, lng: 105.704, demand: 6 },
    { lat: 18.685, lng: 105.703, demand: 5 },
    { lat: 18.657, lng: 105.690, demand: 9 },
    { lat: 18.671, lng: 105.718, demand: 8 },
    { lat: 18.689, lng: 105.688, demand: 4 },
    { lat: 18.662, lng: 105.674, demand: 10 },
    { lat: 18.652, lng: 105.705, demand: 7 },
    { lat: 18.683, lng: 105.671, demand: 6 },
    { lat: 18.673, lng: 105.659, demand: 5 },
    { lat: 18.646, lng: 105.684, demand: 9 },
    { lat: 18.700, lng: 105.700, demand: 8 },
    { lat: 18.694, lng: 105.676, demand: 6 },
    { lat: 18.660, lng: 105.721, demand: 7 },
    { lat: 18.678, lng: 105.737, demand: 4 },
    { lat: 18.641, lng: 105.699, demand: 8 },
    { lat: 18.651, lng: 105.662, demand: 6 },
    { lat: 18.707, lng: 105.688, demand: 5 },
    { lat: 18.692, lng: 105.715, demand: 9 },
    { lat: 18.635, lng: 105.675, demand: 7 },
];

// ================= THAM SỐ ACO =================
let ACO = {
    iterations: 60,
    ants: 25,
    alpha: 1.2,
    beta: 3.0,
    rho: 0.15,      // evaporation rate
    q: 1.0,         // pheromone deposit factor (scaled by 1/cost)
    tau0: 1.0,
};


// ================= HIỂN THỊ BẢN ĐỒ =================
const map = L.map('map').setView([18.67,105.69], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
.addTo(map);

// Fix lỗi hiển thị
setTimeout(() => {
    map.invalidateSize();
}, 100);


// ================= CLICK BẢN ĐỒ =================
map.on("click", function(e){

    if(mode === "view") return;

    let lat = e.latlng.lat;
    let lng = e.latlng.lng;

    if(mode === "depot"){
        setDepot(lat, lng);
    }
    else if(mode === "customer"){
        addCustomer(lat, lng);
    }
});


// ================= DEPOT =================
function setDepot(lat, lng){

    depot.lat = lat;
    depot.lng = lng;

    let m = L.marker([lat, lng]).addTo(map).bindPopup("Depot");
    markers.push(m);
}

function setDepotManual(){

    let lat = parseFloat(document.getElementById("depotLat").value);
    let lng = parseFloat(document.getElementById("depotLng").value);

    if(!isNaN(lat) && !isNaN(lng)){
        setDepot(lat, lng);
    }
}


// ================= CUSTOMER =================
function addCustomerPoint({ lat, lng, demand }){
    let c = {
        id: allCustomers.length + 1,
        name: "C" + (allCustomers.length + 1),
        lat, lng,
        demand: Number.isFinite(demand) ? demand : 0,
    };

    allCustomers.push(c);

    let m = L.circleMarker([lat, lng], {
        radius: 8,
        color: "green"
    }).addTo(map).bindPopup(
        `<b>${c.name}</b><br>
        Demand: ${c.demand}`
    );

    markers.push(m);
}

function addCustomer(lat, lng){
    let demand = parseInt(document.getElementById("demand").value);
    if(Number.isNaN(demand)) demand = 0;
    addCustomerPoint({ lat, lng, demand });
}

function addCustomerManual(){

    let lat = parseFloat(document.getElementById("lat").value);
    let lng = parseFloat(document.getElementById("lng").value);

    if(!isNaN(lat) && !isNaN(lng)){
        addCustomer(lat, lng);
    }
}

function shuffleInPlace(arr){
    for(let i = arr.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function addRandomCustomers(){
    let n = parseInt(document.getElementById("sampleCount")?.value ?? "0");
    if(!Number.isFinite(n) || n <= 0){
        alert("Nhập số khách hợp lệ.");
        return;
    }

    // giới hạn theo size dữ liệu mẫu
    n = Math.min(n, sampleCustomers.length);

    const picked = shuffleInPlace([...sampleCustomers]).slice(0, n);
    picked.forEach(p => addCustomerPoint(p));
}

function resetAndAddRandomCustomers(){
    resetMap();
    addRandomCustomers();
}


// ================= XÓA =================
function clearCustomers(){
    allCustomers = [];
    markers.forEach(m => map.removeLayer(m));
    markers = [];
}

function resetMap(){
    allCustomers = [];
    markers.forEach(m => map.removeLayer(m));
    polylines.forEach(l => map.removeLayer(l));
    antPolylines.forEach(l => map.removeLayer(l));
    markers = [];
    polylines = [];
    antPolylines = [];
}


// ================= KHOẢNG CÁCH (km, Haversine) =================
// Dùng cho heuristic/cost của ACO (chỉ đổi đơn vị địa lý, không đổi cơ chế ACO)
function dist(a, b){
    if(!a || !b) return 0;
    const R = 6371;
    const rad = Math.PI / 180;
    const lat1 = a.lat * rad;
    const lat2 = b.lat * rad;
    const dLat = (b.lat - a.lat) * rad;
    const dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function cloneRoutes(routes){
    if(!routes) return null;
    return routes.map(r => r.map(p => ({ ...p })));
}

function refreshRouteMeta(r){
    let cumKm = 0;
    let load = 0;
    if(r.length === 0) return;
    r[0] = { ...r[0], arrival: 0, load: 0 };
    for(let i = 1; i < r.length - 1; i++){
        cumKm += dist(r[i - 1], r[i]);
        load += r[i].demand || 0;
        r[i] = { ...r[i], arrival: cumKm, load };
    }
    const last = r.length - 1;
    cumKm += dist(r[last - 1], r[last]);
    r[last] = { ...r[last], arrival: cumKm, load: 0 };
}

function refreshAllRoutes(routes){
    routes.forEach(refreshRouteMeta);
}

function routeFeasible(r, cap){
    let load = 0;
    for(let i = 1; i < r.length - 1; i++){
        load += r[i].demand || 0;
        if(load > cap) return false;
    }
    return true;
}

function routesAllFeasible(routes, cap){
    return routes.every(r => routeFeasible(r, cap));
}

function copyRoutesInto(dest, src){
    dest.length = 0;
    src.forEach(r => dest.push(r));
}

function reverseSegment(arr, i, j){
    while(i < j){
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
        i++;
        j--;
    }
}

// ================= LOCAL SEARCH (sau ACO, không sửa lõi ACO) =================
function twoOptPass(routes, cap){
    const cur = cost(routes);
    for(let ri = 0; ri < routes.length; ri++){
        const r = routes[ri];
        if(r.length <= 3) continue;
        for(let i = 1; i < r.length - 2; i++){
            for(let j = i + 1; j < r.length - 2; j++){
                const trial = cloneRoutes(routes);
                reverseSegment(trial[ri], i, j);
                if(!routeFeasible(trial[ri], cap)) continue;
                const c = cost(trial);
                if(c + 1e-9 < cur){
                    copyRoutesInto(routes, trial);
                    return true;
                }
            }
        }
    }
    return false;
}

function relocatePass(routes, cap){
    const cur = cost(routes);
    const R = routes.length;
    for(let ri = 0; ri < R; ri++){
        for(let i = 1; i <= routes[ri].length - 2; i++){
            const temp = cloneRoutes(routes);
            const [cust] = temp[ri].splice(i, 1);
            for(let sj = 0; sj < R; sj++){
                for(let k = 1; k <= temp[sj].length - 1; k++){
                    const trial = cloneRoutes(temp);
                    trial[sj].splice(k, 0, cust);
                    if(!routesAllFeasible(trial, cap)) continue;
                    if(cost(trial) + 1e-9 < cur){
                        copyRoutesInto(routes, trial);
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function swapPass(routes, cap){
    const cur = cost(routes);
    const R = routes.length;
    for(let ri = 0; ri < R; ri++){
        for(let rj = ri + 1; rj < R; rj++){
            for(let i = 1; i <= routes[ri].length - 2; i++){
                for(let j = 1; j <= routes[rj].length - 2; j++){
                    const trial = cloneRoutes(routes);
                    const t = trial[ri][i];
                    trial[ri][i] = trial[rj][j];
                    trial[rj][j] = t;
                    if(!routesAllFeasible(trial, cap)) continue;
                    if(cost(trial) + 1e-9 < cur){
                        copyRoutesInto(routes, trial);
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

function applyLocalSearch(routes){
    const cap = parseInt(document.getElementById("capacity")?.value) || Q;
    let guard = 0;
    while(guard++ < 250){
        let moved = false;
        while(twoOptPass(routes, cap)){
            moved = true;
            refreshAllRoutes(routes);
        }
        while(relocatePass(routes, cap)){
            moved = true;
            refreshAllRoutes(routes);
        }
        while(swapPass(routes, cap)){
            moved = true;
            refreshAllRoutes(routes);
        }
        if(!moved) break;
    }
    refreshAllRoutes(routes);
    return routes;
}


// ================= KHỞI TẠO PHEROMONE =================
function init(){
    pheromone = {};
    const nodes = [depot, ...allCustomers];
    for(const i of nodes){
        for(const j of nodes){
            if(i.id === j.id) continue;
            pheromone[i.id + "-" + j.id] = ACO.tau0;
        }
    }
}


// ================= CHỌN ĐIỂM TIẾP THEO =================
function selectNext(current, list){

    let sum = 0;
    let probs = [];

    list.forEach(c => {
        let tau = pheromone[current.id + "-" + c.id] || ACO.tau0;
        let d = dist(current, c);
        let eta = 1 / (d + 1e-9);
        let p = Math.pow(tau, ACO.alpha) * Math.pow(eta, ACO.beta);

        probs.push({c, p});
        sum += p;
    });

    if(sum <= 0) return probs[0]?.c;
    let r = Math.random() * sum;

    for(let o of probs){
        r -= o.p;
        if(r <= 0) return o.c;
    }

    return probs[0].c;
}


// ================= THUẬT TOÁN ACO =================
function build(){

    let routes = [];
    let unvisited = [...allCustomers];

    vehicles = parseInt(document.getElementById("vehicleCount").value);
    Q = parseInt(document.getElementById("capacity").value);

    for(let v = 0; v < vehicles; v++){

        let route = [{...depot, arrival: 0, load: 0}];
        let current = depot, load = 0, time = 0;

        while(unvisited.length){

            let feasible = unvisited.filter(c => {
                let d = dist(current, c);
                return load + c.demand <= Q;
            });

            if(!feasible.length) break;

            let next = selectNext(current, feasible);

            let d = dist(current, next);
            time = time + d;
            load += next.demand;

            route.push({...next, arrival: time, load});

            current = next;
            unvisited = unvisited.filter(x => x.id !== next.id);
        }

        route.push({...depot, arrival: time, load});
        routes.push(route);
    }

    // Nếu còn khách chưa phục vụ => nghiệm không hợp lệ cho CVRP
    if(unvisited.length) return null;
    return routes;
}


// ================= TÍNH COST =================
function cost(routes){

    if(!routes) return Infinity;
    let c = 0;

    routes.forEach(r => {
        for(let i = 0; i < r.length - 1; i++){
            c += dist(r[i], r[i+1]);
        }
    });

    return c;
}


// ================= CẬP NHẬT PHEROMONE =================
function evaporate(){
    for(const k in pheromone){
        pheromone[k] = pheromone[k] * (1 - ACO.rho);
        if(pheromone[k] < 1e-8) pheromone[k] = 1e-8;
    }
}

function deposit(routes, c){
    if(!routes || !isFinite(c) || c <= 0) return;
    const delta = ACO.q / c;
    routes.forEach(r => {
        for(let i = 0; i < r.length - 1; i++){
            let key = r[i].id + "-" + r[i+1].id;
            pheromone[key] = (pheromone[key] || ACO.tau0) + delta;
        }
    });
}


// ================= VẼ ROUTE =================
function draw(routes){

    const colors = ["red","blue","green"];

    routes.forEach((r, i) => {

        let latlngs = r.map(p => [p.lat, p.lng]);

        let line = L.polyline(latlngs, {
            color: colors[i % 3],
            weight: 5
        }).addTo(map);

        polylines.push(line);
    });
}

function clearAntVisual(){
    antPolylines.forEach(l => map.removeLayer(l));
    antPolylines = [];
}

function drawAntSolutions(solutions){
    clearAntVisual();
    // Vẽ mờ để nhìn đàn kiến khám phá
    const baseColors = ["#60a5fa", "#34d399", "#a78bfa", "#fbbf24", "#fb7185", "#38bdf8"];
    solutions.forEach((routes, idx) => {
        if(!routes) return;
        const color = baseColors[idx % baseColors.length];
        routes.forEach((r) => {
            const latlngs = r.map(p => [p.lat, p.lng]);
            const line = L.polyline(latlngs, {
                color,
                weight: 2,
                opacity: 0.22
            }).addTo(map);
            antPolylines.push(line);
        });
    });
}

function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }


// ================= ANIMATION =================
async function animate(routes){

    const carIcon = L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
        iconSize: [30,30]
    });

    for(let r of routes){

        let car = L.marker([r[0].lat, r[0].lng], {
            icon: carIcon
        }).addTo(map);

        for(let i = 0; i < r.length - 1; i++){

            let a = r[i];
            let b = r[i+1];

            let steps = 30;

            for(let k = 0; k <= steps; k++){

                let lat = a.lat + (b.lat - a.lat) * (k / steps);
                let lng = a.lng + (b.lng - a.lng) * (k / steps);

                car.setLatLng([lat, lng]);

                await new Promise(res => setTimeout(res, 20));
            }
        }
    }
}


// ================= BẢNG KẾT QUẢ =================
function showTable(routes){

    let tbody = document.querySelector("#resultTable tbody");
    const sumEl = document.getElementById("distanceSummary");
    tbody.innerHTML = "";
    if(sumEl) sumEl.innerHTML = "";

    refreshAllRoutes(routes);

    let fleetKm = 0;
    routes.forEach((r, i) => {
        let routeKm = 0;
        for(let j = 0; j < r.length - 1; j++){
            const km = dist(r[j], r[j + 1]);
            routeKm += km;
            const cum = (r[j + 1].arrival !== undefined) ? r[j + 1].arrival : routeKm;
            const leg = `${r[j].name ?? "?"} → ${r[j + 1].name ?? "?"}`;
            tbody.innerHTML += `
            <tr>
            <td>Xe ${i + 1}</td>
            <td>${leg}</td>
            <td>${km.toFixed(2)}</td>
            <td>${cum.toFixed(2)}</td>
            <td>${r[j + 1].load ?? ""}</td>
            </tr>`;
        }
        fleetKm += routeKm;
        tbody.innerHTML += `
        <tr class="row-total">
        <td>Xe ${i + 1}</td>
        <td>Tổng quãng đường xe</td>
        <td colspan="2">${routeKm.toFixed(2)} km</td>
        <td>—</td>
        </tr>`;
    });

    if(sumEl){
        sumEl.innerHTML = `
            <strong>Tổng cả đội xe:</strong> ${fleetKm.toFixed(2)} km (Haversine).<br>
            <span style="opacity:.9">Sau khi ACO chạy xong, lời giải được tinh chỉnh thêm bằng <strong>local search</strong> (2-opt, relocate, swap) — không thay đổi thuật toán ACO.</span>
        `;
    }
}


// ================= MAIN =================
async function runACO(){

    if(allCustomers.length === 0){
        alert("Chưa có khách!");
        return;
    }

    polylines.forEach(l => map.removeLayer(l));
    polylines = [];
    clearAntVisual();

    init();

    let best = null;
    let bestCost = Infinity;

    const showAnts = !!document.getElementById("showAnts")?.checked;
    let showAntCount = parseInt(document.getElementById("showAntCount")?.value ?? "0");
    if(!Number.isFinite(showAntCount) || showAntCount <= 0) showAntCount = 6;
    showAntCount = Math.max(1, Math.min(showAntCount, 20));
    let antDelayMs = parseInt(document.getElementById("antDelayMs")?.value ?? "0");
    if(!Number.isFinite(antDelayMs) || antDelayMs < 0) antDelayMs = 180;
    antDelayMs = Math.max(0, Math.min(antDelayMs, 2000));

    for(let it = 0; it < ACO.iterations; it++){
        let iterBest = null;
        let iterBestCost = Infinity;
        let iterSolutions = [];

        for(let a = 0; a < ACO.ants; a++){
            let routes = build();
            let c = cost(routes);
            if(showAnts && iterSolutions.length < showAntCount) iterSolutions.push(routes);
            if(c < iterBestCost){
                iterBestCost = c;
                iterBest = routes;
            }
            if(c < bestCost){
                bestCost = c;
                best = routes;
            }
        }

        if(showAnts){
            drawAntSolutions(iterSolutions);
            await sleep(antDelayMs);
        }

        evaporate();
        // Deposit theo nghiệm tốt nhất của iteration để hội tụ ổn định
        deposit(iterBest, iterBestCost);
    }

    if(!best){
        alert("Không tìm được nghiệm hợp lệ. Thử tăng số xe hoặc tăng capacity.");
        return;
    }

    clearAntVisual();
    refreshAllRoutes(best);
    applyLocalSearch(best);
    draw(best);
    showTable(best);
    await animate(best);
}