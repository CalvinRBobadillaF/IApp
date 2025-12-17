import { useRef, useEffect, useContext } from "react";
import './DropDown.css'
import { Context } from "../../Context/Context";




const DropDown = () => {
  const {models, setModelFeature,  setModels} = useContext(Context)
  const ref = useRef(null);

  const changeModel = (modelName) => {
    let model = modelName
    localStorage.setItem('Model', JSON.stringify(model))
    setModelFeature('Gemini')
   }

   const changeModelGPT = (modelName) => {
    let model = modelName
    localStorage.setItem('ModelGPT', JSON.stringify(model))
    setModelFeature('GPT')
   }

   const changeModelClaude = (modelName) => {
    let model = modelName
    localStorage.setItem('ModelClaude', JSON.stringify(model))
    setModelFeature('Claude')
   }


  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setModels(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      
      

      {/* Dropdown */}
      {models && (
        <div
          className="radio-group"
          style={{
            position: "absolute",
            top: "100%",
            left: -105,
            background: "#1e1e1e",
            marginTop: "10px",
            borderRadius: "8px",
            padding: "8px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
            zIndex: 100,
          }}
        >
          <div className="radio-option" onClick={() => changeModelGPT('gpt-5') } > ChatGPT</div>
          <div className="radio-option">Grok</div>
          <div className="radio-option" onClick={() => changeModelClaude('claude-sonnet-4-5-20250929') }>  Claude</div>
          <div className="radio-option" onClick={() => changeModel('gemini-2.5-flash') }> Gemini</div>
          
        </div>
      )}
    </div>
  );
};

export default DropDown;
