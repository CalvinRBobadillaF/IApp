import { useContext, useState } from 'react'
import './Login.css'
import { Context } from '../../Context/context.js'

const Login = () => {
    const { userName, setUserName, completeLogin } = useContext(Context);
    const [error, setError] = useState("");

    const setData = () => {
        // Validación mínima
        if (!userName.trim()) {
            setError("Please enter your name.");
            return;
        }
        setError("");
        completeLogin(userName);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) setData();
    };

    return (
        <div className="login-container">
            <div className="login-header">
                <h1 className="login-title">IApp</h1>
                <p className="login-subtitle">Your AI Hub</p>
            </div>

            <div className="login-box">
                <div className="input-group">
                    <label className="input-label" htmlFor="display-name">Name</label>
                    <input
                        id="display-name"
                        type="text"
                        value={userName}
                        maxLength={100}
                        placeholder="Your name..."
                        onChange={(e) => setUserName(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>

                {error && <p className="login-error">{error}</p>}
            </div>

            <button
                className="login-btn"
                onClick={setData}
            >
                Get Started →
            </button>

            <p className="login-note">Choose a display name for this device. Provider credentials are configured on the IApp server.</p>
        </div>
    );
};

export default Login;
