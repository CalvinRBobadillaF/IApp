import { useRef, useEffect, useContext } from "react";
import './DropDown.css';
import { Context } from "../../Context/Context";

const DropDown = () => {
  const { models, setModelFeature, setModels } = useContext(Context);
  const ref = useRef(null);

  const selectModel = (storageKey, value, feature) => {
    localStorage.setItem(storageKey, JSON.stringify(value));
    localStorage.setItem('ModelFeature', feature);
    setModelFeature(feature);
    setModels(false);
  };

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
      {models && (
        <div className="dropdown-menu">
          <div className="radio-option radio-option--gpt"
            onClick={() => selectModel('ModelGPT', 'gpt-5.6-terra', 'GPT')}>
            ChatGPT
          </div>
          <div className="radio-option radio-option--claude"
            onClick={() => selectModel('ModelClaude', 'claude-opus-5', 'Claude')}>
            Claude
          </div>
          <div className="radio-option radio-option--gemini"
            onClick={() => selectModel('Model', 'gemini-3.8-flash', 'Gemini')}>
            Gemini
          </div>
        </div>
      )}
    </div>
  );
};

export default DropDown;
