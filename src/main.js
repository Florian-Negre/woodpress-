import './styles/tokens.css'
import { renderApp } from './app.js'
import { initConfig, getConfig } from './configStore.js'

// La configuration est lue dans le fichier de l'utilisateur avant tout affichage,
// pour que le premier rendu parte des bons reglages.
initConfig().then(() => {
  if (getConfig().theme === 'light') document.documentElement.classList.add('light')
  renderApp(document.getElementById('app'))
})
