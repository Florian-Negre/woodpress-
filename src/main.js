import { invoke } from '@tauri-apps/api/core'
import './styles/tokens.css'
import { renderApp } from './app.js'

// Thème : lecture depuis localStorage avec fallback dark
const savedTheme = localStorage.getItem('wp-theme') || 'dark'
if (savedTheme === 'light') document.documentElement.classList.add('light')

// Démarrage de l'application
renderApp(document.getElementById('app'))
