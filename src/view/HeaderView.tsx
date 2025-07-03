import logo from "../assets/logo.png";
import "../styles/HeaderView.css";

export default function HeaderView() {
    return (
        <>
            <header className="header">
                <img src={logo} alt="BiblioWeb Logo" className="logo-image" />
                <button className="menu-button">☰</button>
            </header>

            <div className="search-bar">
                <input
                    type="text"
                    placeholder="Procure por: título, autor ou descrição de um livro"
                    className="search-input"
                />
            </div>
        </>
    );
}
