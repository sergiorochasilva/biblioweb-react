import { Routes, Route } from "react-router-dom";
import HomeView from "./view/HomeView";
import BookDetailsWrapper from "./view/BookDetailsWrapper";
import SearchView from "./view/SearchView";
import PublisherAdminView from "./view/PublisherAdminView";
import LoginView from "./view/LoginView";
import CodeVerificationView from "./view/CodeVerificationView";
import SelectionView from "./view/SelectionView";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginView />} />
            <Route path="/verify-code" element={<CodeVerificationView />} />
            <Route path="/selection" element={<SelectionView />} />
            <Route path="/" element={<HomeView />} />
            <Route path="/book/:id" element={<BookDetailsWrapper />} />
            <Route path="/search" element={<SearchView />} />

            <Route element={<ProtectedRoute />}>
                <Route path="/publisher-admin" element={<PublisherAdminView />} />
            </Route>
        </Routes>
    );
}
