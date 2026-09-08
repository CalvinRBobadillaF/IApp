
import { lazy, Suspense, useContext } from 'react'
import './App.css'
import Main from './components/Main/Main'
import Sidebar from './components/Sidebar/ChatSidebar'
import { Context } from './Context/context.js'
import Login from './components/Login/Login'
import MainGPT from './components/MainGPT/MainGPT'
import MainClaude from './components/MainClaude/MainClaude'
import Modal from './components/Modal/Modal'

const Tools = lazy(() => import('./components/Tools/Tools'))
const Interpreter = lazy(() => import('./features/interpreter/Interpreter'))

function App() {
  const {modelFeature, signedIn, activeSection, setActiveSection, openModal} = useContext(Context)
  
  
  if (!signedIn) {
    
    return(
      <>
      <Login />
      </>
    )
  }

  return (
    <>
    <Sidebar provider={modelFeature} />
    <Suspense fallback={<main className={`iapp-chat iapp-chat-${modelFeature.toLowerCase()}`}><p role="status" style={{padding: 28}}>Loading workspace…</p></main>}>
      {activeSection === 'tools' ? <Tools onOpenInterpreter={() => setActiveSection('interpreter')} />
        : activeSection === 'interpreter' ? <Interpreter onBack={() => setActiveSection('tools')} />
          : modelFeature === 'GPT' ? <MainGPT /> : modelFeature === 'Claude' ? <MainClaude /> : <Main />}
    </Suspense>
    {openModal && <div className={`iapp-overlay-theme iapp-chat-${modelFeature.toLowerCase()}`}><Modal /></div>}
    </>
  )

}

export default App
