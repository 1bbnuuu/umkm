let map;
let allMarkers = [];
let allPolygons = [];
let areasVisible = true;
let activeFilters = new Set();
let jenisData = new Map();

const umkmIcons = {
    'makanan': { icon: 'fa-utensils', color: '#dc2626' },
    'minuman': { icon: 'fa-coffee', color: '#7c3aed' },
    'kerajinan': { icon: 'fa-shopping-bag', color: '#059669' },
    'tekstil': { icon: 'fa-tshirt', color: '#0891b2' },
    'furniture': { icon: 'fa-chair', color: '#ea580c' },
    'elektronik': { icon: 'fa-mobile-alt', color: '#4338ca' },
    'otomotif': { icon: 'fa-car', color: '#374151' },
    'jasa': { icon: 'fa-hands-helping', color: '#9333ea' },
    'pertanian': { icon: 'fa-seedling', color: '#16a34a' },
    'perikanan': { icon: 'fa-fish', color: '#0284c7' },
    'kosmetik': { icon: 'fa-palette', color: '#ec4899' },
    'farmasi': { icon: 'fa-pills', color: '#dc2626' },
    'default': { icon: 'fa-store', color: '#6b7280' }
};

const colorMap = {
    'merah': '#dc2626',
    'biru': '#2563eb',
    'hijau': '#16a34a',
    'kuning': '#eab308',
    'ungu': '#7c3aed',
    'orange': '#ea580c',
    'pink': '#ec4899',
    'abu': '#6b7280',
    'abu-abu': '#6b7280',
    'coklat': '#92400e',
    'hitam': '#374151',
    'putih': '#ffffff',
    'tosca': '#06b6d4',
    'lime': '#84cc16',
    'indigo': '#4f46e5',
};

const areaColors = ['#FF6B6B'];
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2VYB_TLIqZQU9l2WIyZsf0uVMhpPurSD-5Zj0QmSIm_z5mIeQtF56r5zWXV_JIRYGRfVoFq397HBO/pub?output=csv';

function parseCustomColor(colorInput) {
    if (!colorInput || !colorInput.trim()) {
        return areaColors[0];
    }
    
    const color = colorInput.toLowerCase().trim();
    
    if (/^#([0-9A-F]{3}){1,2}$/i.test(colorInput.trim())) {
        return colorInput.trim();
    }
    
    if (colorMap[color]) {
        return colorMap[color];
    }
    
    const testDiv = document.createElement('div');
    testDiv.style.color = colorInput.trim();
    document.body.appendChild(testDiv);
    const computedColor = window.getComputedStyle(testDiv).color;
    document.body.removeChild(testDiv);
    
    if (computedColor && computedColor !== 'rgb(0, 0, 0)') {
        const rgbMatch = computedColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }
    }
    
    console.warn(`Color "${colorInput}" not recognized, using default`);
    return areaColors[0];
}

function initMap() {
    map = L.map('map').setView([-2.2088, 113.9213], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
    
    loadUMKMData();
}

function createCustomIcon(type) {
    const iconConfig = umkmIcons[type?.toLowerCase()] || umkmIcons.default;
    
    const iconHtml = `
        <div style="
            background-color: ${iconConfig.color};
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            border: 3px solid white;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transform: rotate(-45deg);
            position: relative;
        ">
            <i class="fas ${iconConfig.icon}" style="
                color: white;
                font-size: 12px;
                transform: rotate(45deg);
            "></i>
        </div>
    `;
    
    return L.divIcon({
        html: iconHtml,
        className: 'custom-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}

function loadUMKMData() {
    updateStatus('Mengambil data dari Google Sheets...', 'bg-yellow-100 text-yellow-800');
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('errorMessage').style.display = 'none';
    
    Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            console.log('Data berhasil dimuat:', results);
            
            if (results.data && results.data.length > 0) {
                processUMKMData(results.data);
            } else {
                showError('Data kosong atau tidak valid');
            }
        },
        error: function(error) {
            console.error('Error parsing CSV:', error);
            showError('Gagal mengambil data: ' + error.message);
        }
    });
}

function processUMKMData(data) {
    clearMarkersAndPolygons();
    jenisData.clear();
    
    let validLocations = 0;
    let validAreas = 0;
    const jenisCounter = new Set();
    
    data.forEach(function(row, index) {
        const name = row['Name'] || row['name'] || row['Nama'] || row['nama'] || `UMKM ${index + 1}`;
        const address = row['Address'] || row['address'] || row['Alamat'] || row['alamat'] || 'Alamat tidak tersedia';
        const type = row['Jenis'] || row['type'] || row['jenis'] || row['kategori'] || row['Kategori'] || 'default';
        const images = row['gambar'] || row['images'] || row['Gambar'] || row['foto'] || row['Foto'] || '';
        const googleMapsLink = row['GoogleMaps'] || row['googlemaps'] || row['Google Maps'] || row['maps'] || '';
        const lat = parseFloat(row['latitude'] || row['Latitude'] || row['Lat'] || row['lat']);
        const lng = parseFloat(row['Longitude'] || row['longitude'] || row['Lng'] || row['lng'] || row['Long']);
        const area = row['area'] || row['Area'] || row['polygon'] || row['Polygon'] || '';
        const customColor = row['Warna'] || row['warna'] || row['Color'] || row['color'] || '';
        
        const normalizedType = type.toLowerCase();
        
        if (!jenisData.has(normalizedType)) {
            jenisData.set(normalizedType, {
                name: type,
                markers: [],
                polygons: [],
                count: 0
            });
        }
        
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            const marker = addMarker(lat, lng, name, address, type, images, googleMapsLink);
            jenisData.get(normalizedType).markers.push(marker);
            jenisData.get(normalizedType).count++;
            validLocations++;
            jenisCounter.add(normalizedType);
        }
        
        if (area && area.trim()) {
            const polygon = addPolygonArea(area, name, type, customColor, validAreas);
            if (polygon) {
                jenisData.get(normalizedType).polygons.push(polygon);
                if (!jenisData.get(normalizedType).markers.length) {
                    jenisData.get(normalizedType).count++;
                }
                validAreas++;
                jenisCounter.add(normalizedType);
            }
        }
    });
    
    // Initialize filters to show all (all selected by default)
    activeFilters = new Set(jenisCounter);
    
    // Update statistics
    document.getElementById('totalUMKM').textContent = data.length;
    document.getElementById('totalLokasi').textContent = validLocations;
    document.getElementById('totalJenis').textContent = jenisCounter.size;
    document.getElementById('totalArea').textContent = validAreas;
    
    updateStatus(`${data.length} Data berhasil dimuat`, 'bg-emerald-100 text-emerald-800');
    updateLegend(jenisCounter);
    createFilterControls();
    
    // Apply filters to actually show the markers on map (since all are selected by default)
    applyFilters();
    updateVisibilityCount();
    
    document.getElementById('loading').style.display = 'none';
    
    // Fit map bounds
    if (validLocations > 0 || validAreas > 0) {
        const allLayers = [...allMarkers, ...allPolygons];
        if (allLayers.length > 0) {
            const group = new L.featureGroup(allLayers);
            map.fitBounds(group.getBounds().pad(0.1));
        }
    }
}

function createFilterControls() {
    const filterContainer = document.getElementById('filterContainer');
    filterContainer.innerHTML = '';
    
    if (jenisData.size === 0) {
        filterContainer.innerHTML = '<div class="text-gray-500 italic text-sm">Tidak ada data untuk difilter</div>';
        return;
    }
    
    Array.from(jenisData.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([jenis, data]) => {
            const iconConfig = umkmIcons[jenis] || umkmIcons.default;
            const isActive = activeFilters.has(jenis);
            
            const filterItem = document.createElement('label');
            filterItem.className = 'flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 cursor-pointer transition-colors';
            
            filterItem.innerHTML = `
                <div class="flex items-center space-x-3">
                    <input type="checkbox" class="custom-checkbox" ${isActive ? 'checked' : ''} 
                           onchange="toggleFilter('${jenis}')">
                    <div class="flex items-center space-x-3">
                        <i class="fas ${iconConfig.icon} text-lg" style="color: ${iconConfig.color}"></i>
                        <div>
                            <span class="font-medium text-gray-800 capitalize">${data.name}</span>
                            <div class="text-xs text-gray-500">
                                ${data.markers.length > 0 ? `${data.markers.length} lokasi` : ''}
                                ${data.markers.length > 0 && data.polygons.length > 0 ? ' • ' : ''}
                                ${data.polygons.length > 0 ? `${data.polygons.length} area` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-1">
                    ${data.markers.length > 0 ? `<span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">${data.markers.length}</span>` : ''}
                    ${data.polygons.length > 0 ? `<span class="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">${data.polygons.length}</span>` : ''}
                </div>
            `;
            
            filterContainer.appendChild(filterItem);
        });
}

function toggleFilter(jenis) {
    if (activeFilters.has(jenis)) {
        activeFilters.delete(jenis);
    } else {
        activeFilters.add(jenis);
    }
    
    applyFilters();
    updateVisibilityCount();
}

function selectAllFilters() {
    activeFilters = new Set(jenisData.keys());
    
    // Update all checkboxes
    const checkboxes = document.querySelectorAll('.custom-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    
    applyFilters();
    updateVisibilityCount();
}

function clearAllFilters() {
    activeFilters.clear();
    
    // Update all checkboxes
    const checkboxes = document.querySelectorAll('.custom-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    applyFilters();
    updateVisibilityCount();
}

function applyFilters() {
    jenisData.forEach((data, jenis) => {
        const isVisible = activeFilters.has(jenis);
        
        // Handle markers
        data.markers.forEach(marker => {
            if (isVisible) {
                if (!map.hasLayer(marker)) {
                    map.addLayer(marker);
                }
            } else {
                if (map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }
            }
        });
        
        // Handle polygons
        data.polygons.forEach(polygon => {
            if (isVisible && areasVisible) {
                if (!map.hasLayer(polygon)) {
                    map.addLayer(polygon);
                }
            } else {
                if (map.hasLayer(polygon)) {
                    map.removeLayer(polygon);
                }
            }
        });
    });
}

function updateVisibilityCount() {
    let visibleCount = 0;
    let totalCount = 0;
    
    jenisData.forEach((data, jenis) => {
        const count = Math.max(data.markers.length, data.polygons.length > 0 ? 1 : 0);
        totalCount += count;
        
        if (activeFilters.has(jenis)) {
            visibleCount += count;
        }
    });
    
    document.getElementById('visibleCount').textContent = visibleCount;
    document.getElementById('totalCount').textContent = totalCount;
}

function updateLegend(jenisSet) {
    const legendContainer = document.getElementById('legend');
    legendContainer.innerHTML = '';
    
    if (jenisSet.size === 0) {
        legendContainer.innerHTML = '<div class="text-gray-500 italic">Tidak ada data jenis UMKM</div>';
        return;
    }
    
    Array.from(jenisSet).sort().forEach(jenis => {
        const iconConfig = umkmIcons[jenis.toLowerCase()] || umkmIcons.default;
        const data = jenisData.get(jenis);
        const legendItem = document.createElement('div');
        legendItem.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200';
        legendItem.innerHTML = `
            <div class="flex items-center space-x-3">
                <i class="fas ${iconConfig.icon} text-lg" style="color: ${iconConfig.color}"></i>
                <div>
                    <span class="text-gray-800 font-medium capitalize">${data ? data.name : jenis}</span>
                    <div class="text-xs text-gray-500">
                        ${data && data.markers.length > 0 ? `${data.markers.length} lokasi` : ''}
                        ${data && data.markers.length > 0 && data.polygons.length > 0 ? ' • ' : ''}
                        ${data && data.polygons.length > 0 ? `${data.polygons.length} area` : ''}
                    </div>
                </div>
            </div>
            <div class="flex items-center space-x-1">
                ${data && data.markers.length > 0 ? `<span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">${data.markers.length}</span>` : ''}
                ${data && data.polygons.length > 0 ? `<span class="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">${data.polygons.length}</span>` : ''}
            </div>
        `;
        legendContainer.appendChild(legendItem);
    });
}

function addMarker(lat, lng, name, address, type, images, googleMapsLink) {
    let imageGallery = '';
    if (images && images.trim()) {
        const imageLinks = images.split(',').map(link => link.trim()).filter(link => link);
        if (imageLinks.length > 0) {
            imageGallery = `
                <div class="mt-4 border-t pt-4">
                    <p class="text-sm font-medium text-gray-700 mb-3">Foto UMKM</p>
                    <div class="grid grid-cols-2 gap-2">
                        ${imageLinks.slice(0, 4).map((link, index) => `
                            <div class="relative group cursor-pointer" onclick="openImageModal('${link}', '${name}')">
                                <img src="${link}" 
                                        alt="Foto ${name}" 
                                        class="w-full h-16 object-cover rounded-lg border group-hover:opacity-75 transition-opacity"
                                        onerror="this.parentElement.style.display='none'"
                                        loading="lazy">
                                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 rounded-lg transition-all flex items-center justify-center">
                                    <i class="fas fa-search-plus text-white opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    ${imageLinks.length > 4 ? `<p class="text-xs text-gray-500 mt-2">+${imageLinks.length - 4} foto lainnya</p>` : ''}
                </div>
            `;
        }
    }

    let googleMapsSection = '';
    if (googleMapsLink && googleMapsLink.trim()) {
        googleMapsSection = `
            <div class="mt-4 border-t pt-4">
                <button onclick="openGoogleMaps('${googleMapsLink}')" 
                        class="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors">
                    <i class="fab fa-google"></i>
                    <span>Buka di Google Maps</span>
                    <i class="fas fa-external-link-alt"></i>
                </button>
            </div>
        `;
    } else {
        const fallbackGoogleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        googleMapsSection = `
            <div class="mt-4 border-t pt-4">
                <button onclick="openGoogleMaps('${fallbackGoogleMapsUrl}')" 
                        class="w-full bg-gray-500 hover:bg-gray-600 text-white text-sm py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>Lihat Lokasi di Maps</span>
                    <i class="fas fa-external-link-alt"></i>
                </button>
            </div>
        `;
    }
    
    const iconConfig = umkmIcons[type?.toLowerCase()] || umkmIcons.default;
    
    const marker = L.marker([lat, lng], {
        icon: createCustomIcon(type)
    }).bindPopup(`
        <div class="p-4 max-w-sm">
            <div class="flex items-start space-x-3 mb-3">
                <div class="bg-gray-100 p-2 rounded-lg flex-shrink-0">
                    <i class="fas ${iconConfig.icon}" style="color: ${iconConfig.color}"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <h3 class="font-bold text-gray-800 mb-1">${name}</h3>
                    <span class="inline-block px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full capitalize font-medium">${type}</span>
                </div>
            </div>
            <div class="text-sm text-gray-600 mb-3">
                <i class="fas fa-map-marker-alt mr-1 text-gray-400"></i>
                ${address}
            </div>
            ${imageGallery}
            ${googleMapsSection}
            <div class="text-xs text-gray-400 mt-4 pt-3 border-t">
                <i class="fas fa-crosshairs mr-1"></i>
                ${lat.toFixed(6)}, ${lng.toFixed(6)}
            </div>
        </div>
    `, { maxWidth: 350, className: 'custom-popup' });
    
    allMarkers.push(marker);
    return marker;
}

function addPolygonArea(areaString, name, type, customColor, colorIndex) {
    try {
        const coordinates = areaString.split('|').map(coord => {
            const cleanCoord = coord.trim().replace(/\s+/g, ' ');
            const parts = cleanCoord.split(',').map(c => c.trim());
            
            if (parts.length < 2) {
                throw new Error(`Invalid coordinate format: "${cleanCoord}" - needs lat,lng`);
            }
            
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            
            if (isNaN(lat) || isNaN(lng)) {
                throw new Error(`Invalid coordinates: lat=${parts[0]}, lng=${parts[1]}`);
            }
            
            if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                throw new Error(`Coordinates out of valid range: lat=${lat}, lng=${lng}`);
            }
            
            return [lat, lng];
        }).filter(coord => coord);

        if (coordinates.length < 2) {
            console.warn(`Area "${name}" needs at least 2 coordinates for a line/polygon. Got: ${coordinates.length}`);
            return null;
        }

        const color = parseCustomColor(customColor);
        const iconConfig = umkmIcons[type?.toLowerCase()] || umkmIcons.default;

        let shape;
        let shapeType;
        
        if (coordinates.length === 2) {
            shape = L.polyline(coordinates, {
                color: color,
                weight: 4,
                opacity: 0.8,
                className: 'area-polygon'
            });
            shapeType = 'Garis';
        } else {
            shape = L.polygon(coordinates, {
                color: color,
                fillColor: color,
                weight: 2,
                opacity: 0.9,
                fillOpacity: 0.3,
                className: 'area-polygon'
            });
            shapeType = 'Area';
        }

        shape.bindPopup(`
            <div class="p-4">
                <div class="flex items-start space-x-3 mb-3">
                    <div class="bg-gray-100 p-2 rounded-lg flex-shrink-0">
                        <i class="fas ${iconConfig.icon}" style="color: ${iconConfig.color}"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <h3 class="font-bold text-gray-800 mb-1">${name}</h3>
                        <span class="inline-block px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full capitalize font-medium">${type}</span>
                    </div>
                </div>
                ${customColor ? `
                    <div class="flex items-center text-sm text-gray-600 mb-3">
                        <div class="w-4 h-4 rounded mr-2 border border-gray-300" style="background-color: ${color}"></div>
                    </div>
                ` : ''}
                <div class="text-xs text-gray-400 pt-3 border-t">
                    <i class="fas ${coordinates.length === 2 ? 'fa-minus' : 'fa-draw-polygon'} mr-1"></i>
                    ${shapeType} dengan ${coordinates.length} titik koordinat
                </div>
            </div>
        `, { maxWidth: 300, className: 'custom-popup' });

        allPolygons.push(shape);
        return shape;

    } catch (error) {
        console.error('Error creating area shape for:', name, 'Error:', error.message);
        return null;
    }
}

function showError(message) {
    updateStatus('Gagal memuat data', 'bg-red-100 text-red-800');
    document.getElementById('loading').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'flex';
}

function clearMarkersAndPolygons() {
    allMarkers.forEach(marker => {
        if (map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    });
    allPolygons.forEach(polygon => {
        if (map.hasLayer(polygon)) {
            map.removeLayer(polygon);
        }
    });
    allMarkers = [];
    allPolygons = [];
}

function updateStatus(message, className) {
    const statusElement = document.getElementById('dataStatus');
    statusElement.innerHTML = `<i class="fas fa-circle mr-2"></i>${message}`;
    statusElement.className = `inline-flex items-center px-3 py-1 rounded-full text-sm ${className}`;
}

function refreshData() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('errorMessage').style.display = 'none';
    
    // Reset stats
    document.getElementById('totalUMKM').textContent = '-';
    document.getElementById('totalLokasi').textContent = '-';
    document.getElementById('totalJenis').textContent = '-';
    document.getElementById('totalArea').textContent = '-';
    
    // Reset containers
    document.getElementById('legend').innerHTML = '<div class="text-gray-500 italic">Memuat data...</div>';
    document.getElementById('filterContainer').innerHTML = '<div class="text-gray-500 italic text-sm">Memuat filter...</div>';
    
    loadUMKMData();
}

function openGoogleMaps(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

function openImageModal(imageUrl, caption) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalCaption = document.getElementById('modalCaption');
    
    modalImage.src = imageUrl;
    modalCaption.textContent = caption;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('imageModal');
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeImageModal();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeImageModal();
        }
    });
});

window.addEventListener('load', function() {
    setTimeout(initMap, 500);
});