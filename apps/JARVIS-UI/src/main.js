import './styles.css';
import { JarvisApp } from './core/JarvisApp.js';

const host = document.getElementById('app');
const app = new JarvisApp(host);

app.start();
