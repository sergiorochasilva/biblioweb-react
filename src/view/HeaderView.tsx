import { useNavigate, useSearchParams } from "react-router-dom";
import logo from "../assets/logo.png";
import "../styles/HeaderView.css";

export default function HeaderView() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get("query") || ""; // "" se não existir

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            // Redireciona para a tela de busca com o termo digitado
            setSearchParams({ query: e.currentTarget.value });
            navigate(`/search?query=${e.currentTarget.value}`);
        }
    };

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
                    value={query}
                    onChange={(e) => setSearchParams({ query: e.currentTarget.value })}
                    onKeyDown={handleSearch}
                />
            </div>
        </>
    );
}

