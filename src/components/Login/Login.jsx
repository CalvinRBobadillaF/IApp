import { useContext, useState } from 'react'
import './Login.css'
import { Context } from '../../Context/Context'

const Login = () => {
    const { userName, setUserName } = useContext(Context);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const setData = () => {
        // Validación mínima
        if (!userName.trim()) {
            setError("Please enter your name.");
            return;
        }
        setError("");
        setLoading(true);

        localStorage.setItem('User', JSON.stringify(userName.trim()));
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

                {error && <p className="login-error">{error}</p>}
            </div>

            <button
                className={`login-btn ${loading ? "loading" : ""}`}
                onClick={setData}
                disabled={loading}
            >
                {loading ? "Entering..." : "Get Started →"}
            </button>

            <p className="login-note">Your API credentials are securely managed by the IApp server.</p>
        </div>
    );
};

export default Login;
