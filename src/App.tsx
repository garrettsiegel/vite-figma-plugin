import styles from './App.module.css'
import Count from './components/Count'

function App() {
  return (
    <main className={styles.plugin}>
      <h1>Figma Plugin</h1>
      <h2>Rectangle Creator</h2>
      <Count />
    </main>
  )
}

export default App
