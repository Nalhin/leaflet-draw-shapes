import 'leaflet/dist/leaflet.css';
import { map, tileLayer } from 'leaflet';
import { CREATE, drawLayer } from '../src/index';


const myMap = map('map', {tap: true}).setView([51.505, -0.09], 13, );

tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(myMap);


const l = drawLayer({
  mode: CREATE,
  maximumPolygons: 3,
  mergePolygons: false,
});

myMap.addLayer(l);
