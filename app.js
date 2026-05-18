// ============================================================
//  CITY VRP — ACO với Time Window + Traffic Congestion
//  Phiên bản nâng cấp từ CVRP → City VRP
//  Mục tiêu: Tối thiểu tổng quãng đường (+ penalty vi phạm TW)
// ============================================================
 
// ================= KHAI BÁO DỮ LIỆU =================
let allCustomers = [];
let markers = [];
let polylines = [];
let antPolylines = [];
let carMarkers = [];
 
let depot = {
    id: 0, name: "Depot", lat: 18.67, lng: 105.69
};
 
let vehicles = 3;
let Q = 50;
 
// Ma trận pheromone
let pheromone = {};
let mode = "view";
 
// ================= THAM SỐ CITY VRP =================
// Hệ số phạt khi xe đến SAU latest time window
const PENALTY_LATE   = 5.0;   // phạt mỗi km tương đương trễ
// Hệ số phạt khi xe đến TRƯỚC earliest (phải chờ — tính vào thời gian)
const PENALTY_WAIT   = 0.0;   // chờ không phạt, chỉ mất thêm thời gian
 
// Tốc độ xe (km/h) — dùng để đổi khoảng cách → thời gian
const SPEED_NORMAL   = 40;    // km/h bình thường
const SPEED_PEAK     = 20;    // km/h giờ cao điểm (tắc đường)
 
// Giờ cao điểm (giờ trong ngày, 0–24)
const PEAK_MORNING   = { start: 7,  end: 9  };  // 7h–9h sáng
const PEAK_EVENING   = { start: 17, end: 19 };  // 17h–19h chiều
 
// Giờ xuất phát của đội xe (giờ trong ngày)
const DEPART_HOUR    = 7.5;   // 7h30 sáng
 
/**
 * Chuẩn hóa time window sang cùng hệ với currentHour/arrivalHour (giờ trong ngày 0–24).
 * • Nếu timeStart < DEPART_HOUR: coi là số giờ kể TỪ lúc xuất phát → cộng DEPART_HOUR.
 * • Nếu không: coi là giờ trong ngày như ví dụ trong VI_DU_MINH_HOA (7.5 → 9.5 …).
 */
function twClockStart(c) {
    if (!c || c.timeStart === undefined) return DEPART_HOUR;
    const t = c.timeStart;
    return t < DEPART_HOUR ? DEPART_HOUR + t : t;
}
function twClockEnd(c) {
    if (!c || c.timeEnd === undefined) return 24;
    const t = c.timeEnd;
    return (c.timeStart !== undefined && c.timeStart < DEPART_HOUR) ? DEPART_HOUR + t : t;
}
 
// ================= DỮ LIỆU MẪU — TP. VINH (NGHỆ AN) =================
// Các điểm giao hàng mẫu quanh nội thành Vinh (tọa độ gần đúng)
// timeStart/timeEnd: có thể là giờ từ xuất phát (< 7.5) hoặc giờ trong ngày (≥ 7.5) như txt minh họa
const sampleCustomers = [
    { lat: 18.6880, lng: 105.6720, demand: 7,  timeStart: 0.0, timeEnd: 2.0, name: "P. Trường Thi" },
    { lat: 18.6650, lng: 105.6780, demand: 6,  timeStart: 0.5, timeEnd: 2.0, name: "P. Lê Mao" },
    { lat: 18.6920, lng: 105.6980, demand: 5,  timeStart: 0.75, timeEnd: 3.5, name: "P. Quang Trung" },
    { lat: 18.6580, lng: 105.6620, demand: 9,  timeStart: 1.0, timeEnd: 3.5, name: "P. Hưng Bình" },
    { lat: 18.6520, lng: 105.6950, demand: 8,  timeStart: 0.5, timeEnd: 2.5, name: "P. Hưng Phúc" },
    { lat: 18.6780, lng: 105.6550, demand: 4,  timeStart: 1.5, timeEnd: 4.0, name: "P. Vinh Tân" },
    { lat: 18.6720, lng: 105.7080, demand: 10, timeStart: 0.0, timeEnd: 2.0, name: "P. Hưng Dũng" },
    { lat: 18.6420, lng: 105.6880, demand: 7,  timeStart: 2.0, timeEnd: 5.0, name: "P. Bến Thủy" },
    { lat: 18.7020, lng: 105.6680, demand: 6,  timeStart: 0.5, timeEnd: 2.5, name: "P. Nghi Thu" },
    { lat: 18.6820, lng: 105.6480, demand: 5,  timeStart: 1.0, timeEnd: 3.0, name: "P. Trung Đô" },
    { lat: 18.6480, lng: 105.7120, demand: 9,  timeStart: 0.0, timeEnd: 2.0, name: "P. Hà Huy Tập" },
    { lat: 18.6950, lng: 105.7180, demand: 8,  timeStart: 1.5, timeEnd: 3.5, name: "P. Quảng Trung" },
    { lat: 18.7080, lng: 105.6850, demand: 6,  timeStart: 2.0, timeEnd: 4.5, name: "P. Nghi Phú" },
    { lat: 18.6620, lng: 105.7280, demand: 7,  timeStart: 0.5, timeEnd: 2.0, name: "P. Đội Cung" },
    { lat: 18.6700, lng: 105.6380, demand: 4,  timeStart: 1.0, timeEnd: 3.0, name: "P. Trung Đô 2" },
    { lat: 18.6320, lng: 105.6780, demand: 8,  timeStart: 0.0, timeEnd: 1.5, name: "P. Hưng Lộc" },
    { lat: 18.6550, lng: 105.6480, demand: 6,  timeStart: 2.5, timeEnd: 5.0, name: "P. Vinh Tân 2" },
    { lat: 18.6980, lng: 105.6620, demand: 5,  timeStart: 0.5, timeEnd: 2.5, name: "P. Trường Thi 2" },
    { lat: 18.6850, lng: 105.7320, demand: 9,  timeStart: 0.5, timeEnd: 4.0, name: "P. Hồng Sơn" },
    { lat: 18.6280, lng: 105.7020, demand: 7,  timeStart: 3.0, timeEnd: 6.0, name: "P. Nghi Liên" },
];
 
// ================= THAM SỐ ACO =================
let ACO = {
    iterations: 300,
    ants: 25,
    alpha: 1.2, 
    beta: 3.0,
    rho: 0.15, // tỷ lệ bay hơi pheromone mỗi lần cập nhật
    q: 1.0, // lượng pheromone được deposit ngược tỷ lệ với cost
    tau0: 1.0, // lượng pheromone ban đầu trên mỗi cung đường
};
 
 
// ================= TRAFFIC CONGESTION =================
/**
 * Tính hệ số tắc đường dựa trên giờ xuất phát
 * Giờ cao điểm → tốc độ giảm → thời gian di chuyển tăng
 * @param {number} hour - giờ hiện tại (0–24, có thể có phần thập phân)
 * @returns {number} hệ số tốc độ (0–1), 1 = bình thường, <1 = chậm hơn
 */
function trafficFactor(hour) {
    const h = ((hour % 24) + 24) % 24;
    // Giờ cao điểm sáng 7h–9h
    if (h >= PEAK_MORNING.start && h < PEAK_MORNING.end) return SPEED_PEAK / SPEED_NORMAL;
    // Giờ cao điểm chiều 17h–19h
    if (h >= PEAK_EVENING.start && h < PEAK_EVENING.end) return SPEED_PEAK / SPEED_NORMAL;
    return 1.0;
}
 
/**
 * Tính thời gian di chuyển thực tế (giờ) từ A → B
 * có xét tắc đường theo giờ xuất phát
 * @param {object} a - điểm đi (có lat, lng)
 * @param {object} b - điểm đến (có lat, lng)
 * @param {number} departHour - giờ xuất phát từ A
 * @returns {number} thời gian di chuyển (giờ)
 */
function travelTime(a, b, departHour) {
    const km = dist(a, b);
    const factor = trafficFactor(departHour);
    const speed = SPEED_NORMAL * factor; // km/h thực tế
    return km / speed; // giờ
}
 
 
// ================= KIỂM TRA TIME WINDOW =================
/**
 * Kiểm tra xem một route có vi phạm time window không
 * Tính tổng penalty nếu vi phạm
 * @param {Array} route - mảng các điểm trong route
 * @returns {number} tổng penalty (0 = không vi phạm)
 */
function timeWindowPenalty(route) {
    let penalty = 0;
    let currentHour = DEPART_HOUR; // giờ xuất phát từ depot
 
    for (let i = 0; i < route.length - 1; i++) {
        const from = route[i];
        const to   = route[i + 1];
 
        // Thời gian di chuyển đến điểm tiếp theo
        const tt = travelTime(from, to, currentHour);
        currentHour += tt;
 
        // Nếu là điểm khách hàng (không phải depot trả về)
        if (to.id !== 0 && to.timeEnd !== undefined) {
            const ws = twClockStart(to);
            const we = twClockEnd(to);
            if (currentHour < ws) {
                currentHour = ws;
            }
            if (currentHour > we) {
                const late = currentHour - we;
                penalty += late * PENALTY_LATE;
            }
        }
 
        // Thời gian phục vụ tại điểm (giả định 5 phút = 5/60 giờ)
        currentHour += 5 / 60;
    }
    return penalty;
}
 
/**
 * Kiểm tra route có HOÀN TOÀN hợp lệ về time window không
 * (không vi phạm bất kỳ điểm nào)
 */
function routeTimeWindowFeasible(route) {
    let currentHour = DEPART_HOUR;
    for (let i = 0; i < route.length - 1; i++) {
        const from = route[i];
        const to   = route[i + 1];
        const tt   = travelTime(from, to, currentHour);
        currentHour += tt;
        if (to.id !== 0 && to.timeEnd !== undefined) {
            const ws = twClockStart(to);
            const we = twClockEnd(to);
            if (currentHour < ws) currentHour = ws;
            if (currentHour > we + 0.5) return false; // cho phép trễ tối đa 30 phút
        }
        currentHour += 5 / 60;
    }
    return true;
}
 
 
// ================= HIỂN THỊ BẢN ĐỒ =================
function ensureLeafletLoaded() {
    if (typeof L !== "undefined") return true;
    const el = document.getElementById("map");
    if (el) {
        el.style.display = "grid";
        el.style.placeItems = "center";
        el.style.padding = "14px";
        el.innerHTML = `
          <div style="max-width:520px;text-align:center;line-height:1.45">
            <div style="font-weight:700;margin-bottom:6px">Không tải được Leaflet</div>
            <div style="opacity:.85">
              Trình duyệt không load được thư viện bản đồ (Leaflet).<br>
              Hãy kiểm tra Internet / chặn CDN.
            </div>
          </div>
        `;
    }
    return false;
}
 
const map = ensureLeafletLoaded()
    ? L.map('map', { center: [18.67, 105.69], zoom: 12 })
    : null;
 
if (map) {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }).addTo(map);
    setTimeout(() => { map.invalidateSize(); }, 100);
    setTimeout(() => { map.invalidateSize(); }, 400);
    setTimeout(() => { map.invalidateSize(); }, 800);
    window.addEventListener('resize', () => { map.invalidateSize(); });
}
 
 
// ================= CLICK BẢN ĐỒ =================
if (map) map.on("click", function (e) {
    if (mode === "view") return;
    let lat = e.latlng.lat;
    let lng = e.latlng.lng;
    if (mode === "depot") {
        setDepot(lat, lng);
    } else if (mode === "customer") {
        addCustomer(lat, lng);
    }
});
 
 
// ================= DEPOT =================
function setDepot(lat, lng) {
    if (!map) {
        alert("Bản đồ chưa sẵn sàng — kiểm tra mạng / CDN Leaflet.");
        return;
    }
    depot.lat = lat;
    depot.lng = lng;
    let m = L.marker([lat, lng]).addTo(map).bindPopup("🏭 Depot (Kho)");
    markers.push(m);
}
 
function setDepotManual() {
    let lat = parseFloat(document.getElementById("depotLat").value);
    let lng = parseFloat(document.getElementById("depotLng").value);
    if (!isNaN(lat) && !isNaN(lng)) {
        setDepot(lat, lng);
    }
}
 
 
// ================= CUSTOMER =================
function addCustomerPoint({ lat, lng, demand, timeStart, timeEnd, name }) {
    if (!map) {
        alert("Bản đồ chưa sẵn sàng — kiểm tra mạng / CDN Leaflet.");
        return;
    }
    // Lấy time window từ input nếu không truyền vào
    const twStart = (timeStart !== undefined) ? timeStart
        : parseFloat(document.getElementById("twStart")?.value ?? "0") || 0;
    const twEnd   = (timeEnd   !== undefined) ? timeEnd
        : parseFloat(document.getElementById("twEnd")?.value   ?? "9") || 9;
 
    let c = {
        id: allCustomers.length + 1,
        name: name || ("C" + (allCustomers.length + 1)),
        lat, lng,
        demand:    Number.isFinite(demand) ? demand : 0,
        timeStart: twStart,
        timeEnd:   twEnd,
    };
    allCustomers.push(c);
 
    // Màu marker theo time window: xanh = rộng, vàng = hẹp, đỏ = rất hẹp
    const twRange = twEnd - twStart;
    const markerColor = twRange <= 1 ? "red" : twRange <= 2 ? "orange" : "green";
 
    const twS = twClockStart(c);
    const twE = twClockEnd(c);
    let m = L.circleMarker([lat, lng], {
        radius: 8,
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.7,
    }).addTo(map).bindPopup(
        `<b>${c.name}</b><br>
         Demand: ${c.demand}<br>
         🕐 Khung giao: ${twS.toFixed(2)}h – ${twE.toFixed(2)}h (đồng hồ)<br>
         <small style="opacity:.7">Lưu trong bộ nhớ: ${twStart.toFixed(2)}–${twEnd.toFixed(2)} (${twStart < DEPART_HOUR ? "từ xuất phát" : "đồng hồ"})</small>`
    );
    markers.push(m);
}
 
function addCustomer(lat, lng) {
    let demand = parseInt(document.getElementById("demand").value);
    if (Number.isNaN(demand)) demand = 0;
    addCustomerPoint({ lat, lng, demand });
}
 
function addCustomerManual() {
    const rawLat = document.getElementById("lat")?.value?.trim()?.replace(",", ".") ?? "";
    const rawLng = document.getElementById("lng")?.value?.trim()?.replace(",", ".") ?? "";
    const lat = parseFloat(rawLat);
    const lng = parseFloat(rawLng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
        alert("Hãy nhập vĩ độ và kinh độ (số hợp lệ). Ví dụ: 18,688 và 105,672");
        return;
    }
    addCustomer(lat, lng);
}
 
function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
 
function addRandomCustomers() {
    let n = parseInt(document.getElementById("sampleCount")?.value ?? "0");
    if (!Number.isFinite(n) || n <= 0) {
        alert("Nhập số khách hợp lệ.");
        return;
    }
    n = Math.min(n, sampleCustomers.length);
    const picked = shuffleInPlace([...sampleCustomers]).slice(0, n);
    picked.forEach(p => addCustomerPoint(p));
}
 
function resetAndAddRandomCustomers() {
    resetMap();
    addRandomCustomers();
}
 
 
// ================= XÓA =================
function clearCustomers() {
    if (!map) { allCustomers = []; markers = []; return; }
    allCustomers = [];
    markers.forEach(m => map.removeLayer(m));
    markers = [];
}
 
function resetMap() {
    if (!map) { allCustomers = []; markers = []; polylines = []; antPolylines = []; carMarkers = []; return; }
    allCustomers = [];
    markers.forEach(m => map.removeLayer(m));
    polylines.forEach(l => map.removeLayer(l));
    antPolylines.forEach(l => map.removeLayer(l));
    carMarkers.forEach(c => map.removeLayer(c));
    markers = [];
    polylines = [];
    antPolylines = [];
    carMarkers = [];
}
 
 
// ================= KHOẢNG CÁCH (km, Haversine) =================
function dist(a, b) {
    if (!a || !b) return 0;
    const R = 6371;
    const rad = Math.PI / 180;
    const lat1 = a.lat * rad;
    const lat2 = b.lat * rad;
    const dLat = (b.lat - a.lat) * rad;
    const dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
 
function cloneRoutes(routes) {
    if (!routes) return null;
    return routes.map(r => r.map(p => ({ ...p })));
}
 
function refreshRouteMeta(r) {
    let cumKm = 0;
    let load  = 0;
    let hour  = DEPART_HOUR;
    if (r.length === 0) return;
    r[0] = { ...r[0], arrival: 0, load: 0, arrivalHour: hour };
 
    for (let i = 1; i < r.length - 1; i++) {
        const tt = travelTime(r[i - 1], r[i], hour);
        hour    += tt;
        cumKm   += dist(r[i - 1], r[i]);
        load    += r[i].demand || 0;
 
        // Đợi nếu đến sớm hơn time window
        if (r[i].timeStart !== undefined && hour < twClockStart(r[i])) {
            hour = twClockStart(r[i]);
        }
 
        r[i] = { ...r[i], arrival: cumKm, arrivalHour: hour, load };
        hour += 5 / 60; // thời gian phục vụ
    }
 
    const last = r.length - 1;
    if (last > 0) {
        const tt = travelTime(r[last - 1], r[last], hour);
        hour  += tt;
        cumKm += dist(r[last - 1], r[last]);
        r[last] = { ...r[last], arrival: cumKm, arrivalHour: hour, load: 0 };
    }
}
 
function refreshAllRoutes(routes) {
    routes.forEach(refreshRouteMeta);
}
 
function routeFeasible(r, cap) {
    let load = 0;
    for (let i = 1; i < r.length - 1; i++) {
        load += r[i].demand || 0;
        if (load > cap) return false;
    }
    return true;
}
 
function routesAllFeasible(routes, cap) {
    return routes.every(r => routeFeasible(r, cap));
}
 
function copyRoutesInto(dest, src) {
    dest.length = 0;
    src.forEach(r => dest.push(r));
}
 
function reverseSegment(arr, i, j) {
    while (i < j) {
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        i++; j--;
    }
}
 
 
// ================= LOCAL SEARCH (xét time window) =================
function twoOptPass(routes, cap) {
    const cur = cost(routes);
    for (let ri = 0; ri < routes.length; ri++) {
        const r = routes[ri];
        if (r.length <= 3) continue;
        for (let i = 1; i < r.length - 2; i++) {
            for (let j = i + 1; j < r.length - 2; j++) {
                const trial = cloneRoutes(routes);
                reverseSegment(trial[ri], i, j);
                if (!routeFeasible(trial[ri], cap)) continue;
                if (cost(trial) + 1e-9 < cur) {
                    copyRoutesInto(routes, trial);
                    return true;
                }
            }
        }
    }
    return false;
}
 
function relocatePass(routes, cap) {
    const cur = cost(routes);
    const R = routes.length;
    for (let ri = 0; ri < R; ri++) {
        for (let i = 1; i <= routes[ri].length - 2; i++) {
            const temp = cloneRoutes(routes);
            const [cust] = temp[ri].splice(i, 1);
            for (let sj = 0; sj < R; sj++) {
                for (let k = 1; k <= temp[sj].length - 1; k++) {
                    const trial = cloneRoutes(temp);
                    trial[sj].splice(k, 0, cust);
                    if (!routesAllFeasible(trial, cap)) continue;
                    if (cost(trial) + 1e-9 < cur) {
                        copyRoutesInto(routes, trial);
                        return true;
                    }
                }
            }
        }
    }
    return false;
}
 
function swapPass(routes, cap) {
    const cur = cost(routes);
    const R = routes.length;
    for (let ri = 0; ri < R; ri++) {
        for (let rj = ri + 1; rj < R; rj++) {
            for (let i = 1; i <= routes[ri].length - 2; i++) {
                for (let j = 1; j <= routes[rj].length - 2; j++) {
                    const trial = cloneRoutes(routes);
                    const t = trial[ri][i];
                    trial[ri][i] = trial[rj][j];
                    trial[rj][j] = t;
                    if (!routesAllFeasible(trial, cap)) continue;
                    if (cost(trial) + 1e-9 < cur) {
                        copyRoutesInto(routes, trial);
                        return true;
                    }
                }
            }
        }
    }
    return false;
}
 
function applyLocalSearch(routes) {
    const cap = parseInt(document.getElementById("capacity")?.value) || Q;
    let guard = 0;
    while (guard++ < 250) {
        let moved = false;
        while (twoOptPass(routes, cap))    { moved = true; refreshAllRoutes(routes); }
        while (relocatePass(routes, cap))  { moved = true; refreshAllRoutes(routes); }
        while (swapPass(routes, cap))      { moved = true; refreshAllRoutes(routes); }
        if (!moved) break;
    }
    refreshAllRoutes(routes);
    return routes;
}
 
 
// ================= KHỞI TẠO PHEROMONE =================
function init() {
    pheromone = {};
    const nodes = [depot, ...allCustomers];
    for (const i of nodes) {
        for (const j of nodes) {
            if (i.id === j.id) continue;
            pheromone[i.id + "-" + j.id] = ACO.tau0;
        }
    }
}
 
 
// ================= CHỌN ĐIỂM TIẾP THEO (City VRP) =================
/**
 * Xác suất chọn điểm tiếp theo trong ACO
 * Xét thêm time window urgency: điểm có time window hẹp được ưu tiên hơn
 */
function selectNext(current, list, currentHour) {
    let sum = 0;
    let probs = [];
 
    list.forEach(c => {
        const tau = pheromone[current.id + "-" + c.id] || ACO.tau0;
        const km  = dist(current, c);
        const eta = 1 / (km + 1e-9); // heuristic khoảng cách
 
        // ---- City VRP: Time Window Urgency ----
        // Điểm sắp hết cửa sổ thời gian → urgency cao hơn
        const tt         = travelTime(current, c, currentHour);
        const arriveHour = currentHour + tt;
        let   twUrgency  = 1.0;
 
        if (c.timeEnd !== undefined) {
            const twE      = twClockEnd(c);
            const timeLeft = twE - arriveHour; // giờ còn lại trước khi trễ (đồng hồ)
            if (timeLeft < 0) {
                // Đã trễ → giảm xác suất chọn
                twUrgency = 0.1;
            } else if (timeLeft < 0.5) {
                // Sắp trễ (< 30 phút) → tăng ưu tiên gấp đôi
                twUrgency = 2.0;
            } else if (timeLeft < 1.0) {
                twUrgency = 1.5;
            }
        }
 
        const p = Math.pow(tau, ACO.alpha) * Math.pow(eta, ACO.beta) * twUrgency;
        probs.push({ c, p });
        sum += p;
    });
 
    if (sum <= 0) return probs[0]?.c;
    let r = Math.random() * sum;
    for (let o of probs) {
        r -= o.p;
        if (r <= 0) return o.c;
    }
    return probs[0].c;
}
 
 
// ================= THUẬT TOÁN ACO — BUILD ROUTE (City VRP) =================
function build(numVehicles, capacity) {
    let routes    = [];
    let unvisited = [...allCustomers];
 
    for (let v = 0; v < numVehicles; v++) {
        let route       = [{ ...depot, arrival: 0, load: 0, arrivalHour: DEPART_HOUR }];
        let current     = depot;
        let load        = 0;
        let currentHour = DEPART_HOUR;
 
        while (unvisited.length) {
            // Lọc khách hàng còn có thể phục vụ (capacity)
            let feasible = unvisited.filter(c => load + c.demand <= capacity);
            if (!feasible.length) break;
 
            // ---- City VRP: lọc thêm theo time window ----
            // Ưu tiên những khách hàng CÒN CÓ THỂ đến kịp (không trễ quá 1 giờ)
            const reachable = feasible.filter(c => {
                const tt = travelTime(current, c, currentHour);
                return (currentHour + tt) <= (twClockEnd(c) + 1.0); // cho phép trễ 1h (sẽ bị phạt)
            });
 
            // Nếu không còn ai reachable → kết thúc route này
            const candidates = reachable.length ? reachable : feasible;
 
            let next = selectNext(current, candidates, currentHour);
 
            // Tính thời gian di chuyển có xét traffic
            const tt = travelTime(current, next, currentHour);
            currentHour += tt;
 
            if (next.timeStart !== undefined && currentHour < twClockStart(next)) {
                currentHour = twClockStart(next);
            }
 
            load += next.demand;
 
            route.push({
                ...next,
                arrival:     dist(depot, next), // khoảng cách tích lũy (đơn giản)
                arrivalHour: currentHour,
                load
            });
 
            current = next;
            currentHour += 5 / 60; // thời gian phục vụ 5 phút
            unvisited = unvisited.filter(x => x.id !== next.id);
        }
 
        route.push({ ...depot, arrival: 0, load: 0, arrivalHour: currentHour });
        routes.push(route);
    }
 
    if (unvisited.length) return null;
    return routes;
}
 
 
// ================= TÍNH COST — CITY VRP =================
/**
 * Hàm mục tiêu City VRP:
 * cost = tổng quãng đường (km) + penalty vi phạm time window
 * Mục tiêu: tối thiểu hóa cost
 */
function cost(routes) {
    if (!routes) return Infinity;
    let totalDist    = 0;
    let totalPenalty = 0;
 
    routes.forEach(r => {
        // Quãng đường
        for (let i = 0; i < r.length - 1; i++) {
            totalDist += dist(r[i], r[i + 1]);
        }
        // Penalty time window
        totalPenalty += timeWindowPenalty(r);
    });
 
    return totalDist + totalPenalty;
}
 
/**
 * Tính riêng tổng quãng đường (để hiển thị)
 */
function totalDistance(routes) {
    if (!routes) return 0;
    let d = 0;
    routes.forEach(r => {
        for (let i = 0; i < r.length - 1; i++) d += dist(r[i], r[i + 1]);
    });
    return d;
}
 
/**
 * Tính tổng penalty time window (để hiển thị)
 */
function totalPenalty(routes) {
    if (!routes) return 0;
    return routes.reduce((s, r) => s + timeWindowPenalty(r), 0);
}
 
/**
 * Đếm số điểm vi phạm time window
 */
function countViolations(routes) {
    let count = 0;
    routes.forEach(r => {
        let hour = DEPART_HOUR;
        for (let i = 0; i < r.length - 1; i++) {
            const tt = travelTime(r[i], r[i + 1], hour);
            hour += tt;
            const to = r[i + 1];
            if (to.id !== 0 && to.timeEnd !== undefined) {
                if (hour < twClockStart(to)) hour = twClockStart(to);
                if (hour > twClockEnd(to)) count++;
            }
            hour += 5 / 60;
        }
    });
    return count;
}
 
 
// ================= CẬP NHẬT PHEROMONE =================
function evaporate() {
    for (const k in pheromone) {
        pheromone[k] = pheromone[k] * (1 - ACO.rho);
        if (pheromone[k] < 1e-8) pheromone[k] = 1e-8;
    }
}
 
function deposit(routes, c) {
    if (!routes || !isFinite(c) || c <= 0) return;
    const delta = ACO.q / c;
    routes.forEach(r => {
        for (let i = 0; i < r.length - 1; i++) {
            let key = r[i].id + "-" + r[i + 1].id;
            pheromone[key] = (pheromone[key] || ACO.tau0) + delta;
        }
    });
}
 
 
// ================= VẼ ROUTE =================
function draw(routes) {
    if (!map || !routes) return;
    const colors = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4"];
    routes.forEach((r, i) => {
        let latlngs = r.map(p => [p.lat, p.lng]);
        let line = L.polyline(latlngs, {
            color: colors[i % colors.length],
            weight: 5,
            opacity: 0.85
        }).addTo(map);
        polylines.push(line);
    });
}
 
function clearAntVisual() {
    if (!map) { antPolylines = []; return; }
    antPolylines.forEach(l => map.removeLayer(l));
    antPolylines = [];
}
 
function drawAntSolutions(solutions) {
    if (!map) return;
    clearAntVisual();
    const baseColors = ["#60a5fa", "#34d399", "#a78bfa", "#fbbf24", "#fb7185", "#38bdf8"];
    solutions.forEach((routes, idx) => {
        if (!routes) return;
        const color = baseColors[idx % baseColors.length];
        routes.forEach(r => {
            const latlngs = r.map(p => [p.lat, p.lng]);
            const line = L.polyline(latlngs, {
                color, weight: 2, opacity: 0.22
            }).addTo(map);
            antPolylines.push(line);
        });
    });
}
 
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
 
 
// ================= ANIMATION =================
async function animate(routes) {
    if (!map || !routes) return;
    carMarkers.forEach(c => map.removeLayer(c));
    carMarkers = [];
 
    const carIcon = L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
        iconSize: [30, 30]
    });
 
    for (let r of routes) {
        let car = L.marker([r[0].lat, r[0].lng], { icon: carIcon }).addTo(map);
        carMarkers.push(car);
 
        for (let i = 0; i < r.length - 1; i++) {
            let a = r[i];
            let b = r[i + 1];
            let steps = 30;
            for (let k = 0; k <= steps; k++) {
                let lat = a.lat + (b.lat - a.lat) * (k / steps);
                let lng = a.lng + (b.lng - a.lng) * (k / steps);
                car.setLatLng([lat, lng]);
                await new Promise(res => setTimeout(res, 20));
            }
        }
 
        map.removeLayer(car);
        carMarkers = carMarkers.filter(c => c !== car);
    }
}
 
 
// ================= BẢNG KẾT QUẢ (City VRP) =================
function showTable(routes) {
    let tbody  = document.querySelector("#resultTable tbody");
    const sumEl = document.getElementById("distanceSummary");
    tbody.innerHTML = "";
    if (sumEl) sumEl.innerHTML = "";
 
    refreshAllRoutes(routes);
 
    const totalDist    = totalDistance(routes);
    const totalPen     = totalPenalty(routes);
    const violations   = countViolations(routes);
    const trafficNote  = `Xuất phát lúc ${DEPART_HOUR}h — Giờ cao điểm: ${PEAK_MORNING.start}h–${PEAK_MORNING.end}h & ${PEAK_EVENING.start}h–${PEAK_EVENING.end}h (tốc độ giảm còn ${SPEED_PEAK}km/h)`;
 
    if (sumEl) {
        const penColor = totalPen > 0 ? "#f87171" : "#4ade80";
        sumEl.innerHTML = `
            <strong>📏 Tổng quãng đường:</strong> ${totalDist.toFixed(2)} km<br>
            <strong style="color:${penColor}">⏰ Penalty Time Window:</strong> ${totalPen.toFixed(2)}
            (${violations} điểm vi phạm)<br>
            <strong>🎯 Tổng Cost (City VRP):</strong> ${(totalDist + totalPen).toFixed(2)}<br>
            <span style="opacity:.75;font-size:11px">🚦 ${trafficNote}</span>
        `;
    }
 
    routes.forEach((r, i) => {
        let routeKm = 0;
        for (let j = 0; j < r.length - 1; j++) {
            const km  = dist(r[j], r[j + 1]);
            routeKm  += km;
            const to  = r[j + 1];
            const cum = r[j + 1].arrival ?? routeKm;
 
            // Kiểm tra vi phạm time window của điểm này
            const ah = r[j + 1].arrivalHour;
            let twStatus = "";
            const wS = to.id !== 0 && to.timeEnd !== undefined ? twClockStart(to) : null;
            const wE = to.id !== 0 && to.timeEnd !== undefined ? twClockEnd(to) : null;
            if (to.id !== 0 && to.timeEnd !== undefined && ah !== undefined && wS != null && wE != null) {
                if (ah > wE) {
                    twStatus = `<span style="color:#f87171">⚠ trễ ${((ah - wE) * 60).toFixed(0)}ph</span>`;
                } else if (ah < wS) {
                    twStatus = `<span style="color:#fbbf24">⏳ chờ</span>`;
                } else {
                    twStatus = `<span style="color:#4ade80">✓</span>`;
                }
            }
 
            const arrHourStr = (ah !== undefined && to.id !== 0)
                ? `${Math.floor(DEPART_HOUR + (ah - DEPART_HOUR))}h${String(Math.round(((ah % 1) * 60))).padStart(2,'0')}`
                : "";
 
            tbody.innerHTML += `
            <tr>
                <td>Xe ${i + 1}</td>
                <td>${r[j].name ?? "?"} → ${to.name ?? "?"}</td>
                <td>${km.toFixed(2)}</td>
                <td>${cum.toFixed(2)}</td>
                <td>${to.load ?? ""}</td>
                <td>${to.timeStart !== undefined && to.id !== 0
                    ? `${twClockStart(to).toFixed(2)}–${twClockEnd(to).toFixed(2)}h` : "—"}</td>
                <td>${arrHourStr} ${twStatus}</td>
            </tr>`;
        }
 
        const routePenalty = timeWindowPenalty(r);
        tbody.innerHTML += `
        <tr class="row-total">
            <td>Xe ${i + 1}</td>
            <td>Tổng xe</td>
            <td colspan="2">${routeKm.toFixed(2)} km</td>
            <td>—</td>
            <td colspan="2">Penalty: ${routePenalty.toFixed(2)}</td>
        </tr>`;
    });
}
 
 
// ================= MAIN =================
async function runACO() {
    if (!map) {
        alert("Bản đồ chưa sẵn sàng — không thể chạy ACO.");
        return;
    }
    if (allCustomers.length === 0) {
        alert("Chưa có khách hàng! Hãy thêm điểm giao hàng.");
        return;
    }
 
    polylines.forEach(l => map.removeLayer(l));
    polylines = [];
    clearAntVisual();
 
    const numVehicles = parseInt(document.getElementById("vehicleCount").value);
    const capacity    = parseInt(document.getElementById("capacity").value);
    vehicles = numVehicles;
    Q        = capacity;
 
    init();
 
    let best     = null;
    let bestCost = Infinity;
 
    const showAnts = !!document.getElementById("showAnts")?.checked;
    let showAntCount = parseInt(document.getElementById("showAntCount")?.value ?? "6");
    if (!Number.isFinite(showAntCount) || showAntCount <= 0) showAntCount = 6;
    showAntCount = Math.max(1, Math.min(showAntCount, 20));
 
    let antDelayMs = parseInt(document.getElementById("antDelayMs")?.value ?? "180");
    if (!Number.isFinite(antDelayMs) || antDelayMs < 0) antDelayMs = 180;
    antDelayMs = Math.max(0, Math.min(antDelayMs, 2000));
 
    for (let it = 0; it < ACO.iterations; it++) {
        let iterSolutions    = [];
        let allIterSolutions = [];
 
        for (let a = 0; a < ACO.ants; a++) {
            let routes = build(numVehicles, capacity);
            let c      = cost(routes);
 
            if (routes && isFinite(c)) {
                allIterSolutions.push({ routes, c });
            }
 
            if (showAnts && iterSolutions.length < showAntCount) iterSolutions.push(routes);
 
            if (c < bestCost) {
                bestCost = c;
                best     = routes;
            }
        }
 
        if (showAnts) {
            drawAntSolutions(iterSolutions);
            await sleep(antDelayMs);
        }
 
        evaporate();
        allIterSolutions.forEach(({ routes, c }) => deposit(routes, c));
    }
 
    if (!best) {
        alert("Không tìm được nghiệm hợp lệ. Thử tăng số xe hoặc tăng capacity.");
        return;
    }
 
    clearAntVisual();
    refreshAllRoutes(best);
    applyLocalSearch(best);
    refreshAllRoutes(best);
    draw(best);
    showTable(best);
    await animate(best);
}
 