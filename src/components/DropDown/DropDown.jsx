import { useRef, useEffect, useContext } from "react";
import './DropDown.css';
import { Context } from "../../Context/context.js";

const DropDown = () => {
  const { models, setModelFeature, setModels } = useContext(Context);
  const ref = useRef(null);

  const selectModel = (feature) => {
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
  }, [setModels]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {models && (
        <div className="dropdown-menu">
          <div className="radio-option radio-option--gpt"
            onClick={() => selectModel('GPT')}>
            ChatGPT
          </div>
          <div className="radio-option radio-option--claude"
            onClick={() => selectModel('Claude')}>
            Claude
          </div>
          <div className="radio-option radio-option--gemini"
            onClick={() => selectModel('Gemini')}>
            Gemini
          </div>
        </div>
      )}
    </div>
  );
};

export default DropDown;
