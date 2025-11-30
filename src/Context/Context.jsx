import { createContext, useState, useEffect } from "react";
import main from "../config/gemini";


export const Context = createContext()

const loadState = (key, defaultValue) => {
        try {
            const serializedState = localStorage.getItem(key);
            if (serializedState === null) {
                return defaultValue;
            }
            // Asegúrate de que los prompts sean un array y el resultData sea un string
            return JSON.parse(serializedState);
        } catch (e) {
            console.error("Error al cargar desde localStorage", e);
            return defaultValue;
        }
    };

    

const ContextProvider = (props) => {
    const [openSidebar, setOpenSidebar] = useState(false)

    const [userPrompt, setUserPrompt] = useState('')
    const [recentPrompt, setRecentPrompt] = useState(loadState('recentPrompt', ''));
    const [prevPrompts, setPrevPrompts] = useState(loadState('prevPrompts', []))
    const [showResult, setShowResult] = useState(loadState('showResult', false));
    const [loading, setLoading] = useState(false)
    const [resultData, setResultData] = useState(loadState('resultData', ''));
    const [geminiKey, setGeminiKey] = useState('')
    const [userName, setUserName] = useState('')
    const [logged, setLogged] = useState(false)
    
    
    

    useEffect(() => {
        try {
            localStorage.setItem('recentPrompt', JSON.stringify(recentPrompt));
            localStorage.setItem('prevPrompts', JSON.stringify(prevPrompts));
            localStorage.setItem('showResult', JSON.stringify(showResult));
            localStorage.setItem('resultData', JSON.stringify(resultData));
        } catch (e) {
            console.error("Error al guardar en localStorage", e);
        }
    }, [recentPrompt, prevPrompts, showResult, resultData]);

    
    
    const delayPara = (index, nextWord) => {
        setTimeout(function () {
            setResultData(prev => prev + nextWord)
        }, 30*index)
    }

    const newChat = () => {
        setLoading(false);
        setShowResult(false);
        
        setUserPrompt('');
        setRecentPrompt('');
        setPrevPrompts([]);
        setResultData('');
        localStorage.removeItem('recentPrompt');
        localStorage.removeItem('prevPrompts');
        localStorage.removeItem('showResult');
        localStorage.removeItem('resultData'); 
    }

    const onSent = async (prompt) => {
        const currentPrompt = prompt !== undefined ? prompt : userPrompt;
        
        setLoading(true);
        setShowResult(true);
        setRecentPrompt(currentPrompt);
        
        // Limpiamos resultData para la nueva animación
        setResultData("");

        // Añadimos el prompt del usuario al historial primero
        const updatedPrevPromptsWithUser = [...prevPrompts, { role: 'user', text: currentPrompt }];
        setPrevPrompts(updatedPrevPromptsWithUser);

        try {
            const response = await main(currentPrompt);
            
            let responseText = response.split("**").map((segment, i) => 
                (i === 0 || i % 2 !== 1) ? segment : `<b>${segment}</b>`
            ).join("");
            
            let finalResponse = responseText.split("*").join("</br>");

            // Añadimos la respuesta de la IA al historial
            const finalPrevPrompts = [...updatedPrevPromptsWithUser, { role: 'model', text: finalResponse }];
            setPrevPrompts(finalPrevPrompts);
            
            // Aquí, resultData solo contendrá la *última* respuesta de la IA para la animación.
            const responseWords = finalResponse.split(" ");
            for (let i = 0; i < responseWords.length; i++) {
                const nextWord = responseWords[i];
                delayPara(i, nextWord + " ");
            }

        } catch (error) {
            console.error("Error al enviar el prompt:", error);
            const errorMessage = "Lo siento, ocurrió un error al procesar tu solicitud.";
            setPrevPrompts(prev => [...prev, { role: 'model', text: errorMessage }]);
            // Si hay un error, lo mostramos en resultData también
            setResultData(errorMessage); 
        } finally {
            setLoading(false);
            setUserPrompt('');
        }
    };
   

    const contextValue = {
        userPrompt,
        setUserPrompt,
        setPrevPrompts,
        prevPrompts,
        recentPrompt,
        setRecentPrompt,
        showResult,
        setShowResult,
        loading,
        setLoading,
        resultData,
        setResultData,
        onSent,
        openSidebar,
        setOpenSidebar,
        logged, 
        setLogged,
        userName,
        setUserName,
        geminiKey,
        setGeminiKey,
        newChat
    }
    
    

    return (
        <Context.Provider value={contextValue}>
            {props.children}
        </Context.Provider>
    )
}

export default ContextProvider