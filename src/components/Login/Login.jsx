import { useContext, useState } from 'react'
import './Login.css'
import { Context } from '../../Context/Context'

const Login = () => {
    const { userName, setUserName, geminiKey, setGeminiKey, GPTKey, setGPTKey, claudeKey, setClaudeKey } = useContext(Context);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const setData = () => {
        // Validación mínima
        if (!userName.trim()) {
            setError("Please enter your name.");
            return;
        }
        if (!geminiKey.trim() && !GPTKey.trim() && !claudeKey.trim()) {
            setError("Enter at least one API key.");
            return;
        }

        setError("");
        setLoading(true);

        localStorage.setItem('User', JSON.stringify(userName.trim()));
        localStorage.setItem('Gemini Key', JSON.stringify(geminiKey.trim()));
        localStorage.setItem('GPT Key', JSON.stringify(GPTKey.trim()));
        localStorage.setItem('Claude Key', JSON.stringify(claudeKey.trim()));

        // Pequeño delay para que el usuario vea el feedback
        setTimeout(() => window.location.reload(), 300);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") setData();
    };

    return (
        <div className="login-container">
            <div className="login-header">
                <h1 className="login-title">IApp</h1>
                <p className="login-subtitle">Your AI Hub</p>
            </div>

            <div className="login-box">
                <div className="input-group">
                    <label className="input-label">Name</label>
                    <input
                        type="text"
                        placeholder="Your name..."
                        onChange={(e) => setUserName(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>

                <div className="input-divider">
                    <span>API Keys</span>
                </div>

                <div className="input-group">
                    <label className="input-label gemini-label">Gemini</label>
                    <input
                        type="password"
                        placeholder="AIza..."
                        onChange={(e) => setGeminiKey(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>

                <div className="input-group">
                    <label className="input-label gpt-label">ChatGPT</label>
                    <input
                        type="password"
                        placeholder="sk-..."
                        onChange={(e) => setGPTKey(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>

                <div className="input-group">
                    <label className="input-label claude-label">Claude</label>
                    <input
                        type="password"
                        placeholder="sk-ant-..."
                        onChange={(e) => setClaudeKey(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>

                {error && <p className="login-error">{error}</p>}
            </div>

            <button
                className={`login-btn ${loading ? "loading" : ""}`}
                onClick={setData}
                disabled={loading}
            >
                {loading ? "Entering..." : "Get Started →"}
            </button>

            <p className="login-note">Keys are stored locally and never sent to our servers.</p>
        </div>
    );
};

export default Login;