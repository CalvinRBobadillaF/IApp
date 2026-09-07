
import { useContext } from 'react'
import './App.css'
import Main from './components/Main/Main'
import Sidebar from './components/Sidebar/ChatSidebar'
import { Context } from './Context/context.js'
import Login from './components/Login/Login'
import MainGPT from './components/MainGPT/MainGPT'
import MainClaude from './components/MainClaude/MainClaude'


function App() {
  const {modelFeature, signedIn} = useContext(Context)
  
  
  if (!signedIn) {
    
    return(
      <>
      <Login />
      </>
    )
  }

  if (modelFeature == 'GPT') {
    return(
      <>
      <Sidebar provider="GPT" />
      <MainGPT />
      </>
    )
  }

  if (modelFeature == 'Claude') {
    return(
      <>
      <Sidebar provider="Claude" />
      <MainClaude />
      </>
    )
  }

 
  return (
    <>
    
    <Sidebar />
    <Main />
    </>
  )

}

export default App
