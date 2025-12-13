import { useState, useRef, useEffect, useContext } from "react";
import './DropDown.css'
import { Context } from "../../Context/Context";
import { assets } from "../../assets/assets";


const DropDown = () => {
  const {models, setModelFeature, modelFeature} = useContext(Context)
  const ref = useRef(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
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
          <div className="radio-option" onClick={() => setModelFeature('ChatGPT')}> ChatGPT</div>
          <div className="radio-option">DeepSeek</div>
          <div className="radio-option">Claude</div>
          <div className="radio-option" onClick={() => setModelFeature('Gemini')}>Gemini</div>
          
        </div>
      )}
    </div>
  );
};

export default DropDown;
