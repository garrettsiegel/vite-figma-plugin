import './App.css'
import { useState } from 'react'

function App() {
  const [count, setCount] = useState(5)

  function handleOnChange(event: React.ChangeEvent<HTMLInputElement>) {
    setCount(parseInt(event.target.value))
  }

  function handleCreate() {
    parent.postMessage({ pluginMessage: { type: 'create-shapes', count } }, '*')
  }

  function handleCancel() {
    parent.postMessage({ pluginMessage: { type: 'cancel' } }, '*')
  }

  return (
    <>
      <h2>Rectangle Creator</h2>
      <p>
        Count: <input id="count" type="number" value={count} onChange={handleOnChange} />
      </p>
      <button id="create" onClick={handleCreate}>Create</button>
      <button id="cancel" onClick={handleCancel}>Cancel</button>
    </>
  )
}

export default App
