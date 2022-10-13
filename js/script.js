const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthsShort = ['jan', 'fév', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

function loadJSON(file) {
  return new Promise((resolve, reject) => {
    var xobj = new XMLHttpRequest();
    xobj.overrideMimeType('application/json');
    xobj.open('GET', file, true);
    xobj.onreadystatechange = function () {
      if (xobj.readyState === 4 && xobj.status === 200) {
        resolve(JSON.parse(xobj.responseText));
      }
    };
    xobj.send(null);
  });
}

let tripsPromise = loadJSON('data/trips.json');
let coordsPromise = loadJSON('data/coords.json');

let coords = {};

let allTravellers = ['PM', 'V', 'May'];

let trips = {};
let cities = {};

let traveller = null;
let masks = [true, false, false, false];
let countries = {};

let map;
let markers = [];
let heatmap;
let paths = [];

let queryDict = {}
location.search.substr(1).split("&").forEach(function(item) {queryDict[item.split("=")[0]] = item.split("=")[1]});
let viewParam = queryDict.view;

window.addEventListener('DOMContentLoaded', () => {
  if (viewParam === 'may') {
    document.querySelector('.travellers li:nth-child(1)').style.display = 'none';
  } else {
    document.querySelector('.travellers li:nth-child(3)').style.display = 'none';
  }
});

function initMap() {
  Promise.all([tripsPromise, coordsPromise]).then(res => {
    trips = res[0];
    coords = res[1];

    map = new google.maps.Map(document.getElementById("map"), {
      center: {lat: 25, lng: 0},
      zoom: 3,
      // styles: [{
      //   'featureType': 'all',
      //   'elementType': 'all',
      //   'stylers': [{'visibility': 'off'}]
      // }, {
      //   'featureType': 'landscape',
      //   'elementType': 'geometry',
      //   'stylers': [{'visibility': 'on'}, {'color': '#fcfcfc'}]
      // }, {
      //   'featureType': 'water',
      //   'elementType': 'labels',
      //   'stylers': [{'visibility': 'off'}]
      // }, {
      //   'featureType': 'water',
      //   'elementType': 'geometry',
      //   'stylers': [{'visibility': 'on'}, {'hue': '#5f94ff'}, {'lightness': 60}]
      // }]
    });

    var tripList = document.getElementById('trip-list');
    trips.forEach((trip, tripIndex) => {
      trip.villes.forEach(city => {
        if (!cities[city]) {
          cities[city] = {
            trips: [],
            travellers: []
          };
        }
        if (!cities[city].trips.includes(tripIndex)) {
          cities[city].trips.push(tripIndex);
        }
        cities[city].travellers = cities[city].travellers.concat(trip.voyageurs);
      });

      trip.pays.forEach((country) => {
        if (!countries[country]) {
          countries[country] = [];
        }
        countries[country] = countries[country].concat(trip.voyageurs);
      })

      var node = createTripNode(trip);
      tripList.prepend(node);
    });

    // 1. heatmap
    heatmap = new google.maps.visualization.HeatmapLayer({
      data: [],
      map: map,
      opacity: 0.6,
      radius: 75
    });

    // 2. markers
    Object.keys(cities).forEach(city => {
      if (!coords[city]) {
        console.error("Missing coords for " + city);
      } else {
        markers.push({
          city: city,
          object: new google.maps.Marker({
            position: {lat: coords[city][0], lng: coords[city][1]}
          }),
          displayFn : () => masks[1] && cities[city].travellers.includes(allTravellers[traveller])
        });
      }
    });

    // 3. paths
    trips.forEach(trip => {
      paths.push({
        object: new google.maps.Polyline({
          path: trip.villes.map(city => ({lat: coords[city][0], lng: coords[city][1]})),
          map: map,
          geodesic: true,
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 5
        }),
        displayFn: () => masks[2] && trip.voyageurs.includes(allTravellers[traveller])
      }); 
    });

    // 4. geoJson
    map.data.loadGeoJson('data/countries.geojson');

    map.data.setStyle(feature => ({
      //strokeWeight: 0.5,
      //strokeColor: '#fff',
      //zIndex: 2,
      //fillColor: 'hsl(' + color[0] + ',' + color[1] + '%,' + color[2] + '%)',
      //fillOpacity: 0.05
    }));

    toggleTraveller(viewParam === 'may' ? 2 : 0);
    masks.forEach((mask, index) => updateMask(index));
    toggleZoom(0);
  });
}

function refreshMap() {
  markers.forEach(marker => {
    var dates = cities[marker.city].trips
    .map(tripIndex => trips[tripIndex])
    .filter(trip => trip.voyageurs.includes(allTravellers[traveller]))
    .map(trip => '> ' + months[trip.mois - 1] + ' ' + trip.annee).join('\n');

    marker.object.setTitle(marker.city + '\n' + dates);
    marker.object.setMap(marker.displayFn() ? map : null);
  });

  if (masks[0]) {
    heatmap.setData(
      Object.keys(cities)
      .filter(city => cities[city].travellers.includes(allTravellers[traveller]))
      .map(city => new google.maps.LatLng(coords[city][0], coords[city][1]))
    );
  } else {
    heatmap.setData([]);
  }

  paths.forEach(path => path.object.setMap(path.displayFn() ? map : null));

  map.data.setStyle(feature => ({
    visible: masks[3] && !!countries[feature.getProperty("ADMIN")] && countries[feature.getProperty("ADMIN")].includes(allTravellers[traveller])
  }));
}

function toggleMask(index) {
  masks[index] = !masks[index];
  updateMask(index);
}

function updateMask(index) {
  refreshMap();
  var classList = document.querySelector(`.masks li:nth-child(${index+1})`).classList;
  if (masks[index]) {
    classList.remove('inactive');
  } else {
    classList.add('inactive');
  }
}

function toggleZoom(index) { 
  if (index === 0) {
    map.setCenter({lat: 25, lng: 0});
    map.setZoom(3);
  } else if (index === 1) {
    map.setCenter({lat: 48, lng: 13});
    map.setZoom(5);
  } else if (index === 2) {
    map.setCenter({lat: 46, lng: 2});
    map.setZoom(6);
  }
  document.querySelectorAll('.zoom li').forEach((el, elIndex) => {
    if (elIndex === index) {
      el.classList.remove('inactive');
    } else {
      el.classList.add('inactive');
    }
  });
}

function toggleTraveller(index) {
  traveller = index;
  refreshMap();
  document.querySelectorAll('.travellers li').forEach((el, elIndex) => {
    if (elIndex === index) {
      el.classList.remove('inactive');
    } else {
      el.classList.add('inactive');
    }
  });

  document.querySelectorAll('#trip-list li').forEach((el, elIndex) => {
    if (trips[trips.length - elIndex - 1].voyageurs.includes(allTravellers[traveller])) {
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  });
}

function createTripNode(trip) {
  var node = document.createElement('li');
  node.classList.add('inactive');
  var date = monthsShort[trip.mois - 1] + ' ' + trip.annee;
  node.innerHTML = `<span>${trip.nom}</span> <span class='date'>${date}</span>`;
  if (trip.link) {
    node.innerHTML += `<a href='${trip.nom}' target='_blank'>&#129133;</a>`;
  }
  return node;
}
