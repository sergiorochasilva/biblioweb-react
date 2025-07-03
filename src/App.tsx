import { Routes, Route } from "react-router-dom";
import HomeView from "./view/HomeView";
import BookDetailsWrapper from "./view/BookDetailsWrapper";

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/book/:id" element={<BookDetailsWrapper />} />
        </Routes>
    );
}
