import { Routes, Route } from "react-router-dom";
import HomeView from "./view/HomeView";
import BookDetailsWrapper from "./view/BookDetailsWrapper";
import SearchView from "./view/SearchView";
import AdvancedSearchView from "./view/AdvancedSearchView";
import PublisherAdminView from "./view/PublisherAdminView";
import AdminView from "./view/AdminView";
import LoginView from "./view/LoginView";
import CodeVerificationView from "./view/CodeVerificationView";
import SelectionView from "./view/SelectionView";
import CategoriesView from "./view/CategoriesView";
import AuthorsView from "./view/AuthorsView";
import ProfileView from "./view/ProfileView";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleProtectedRoute from "./components/RoleProtectedRoute";

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginView />} />
            <Route path="/verify-code" element={<CodeVerificationView />} />
            <Route path="/selection" element={<SelectionView />} />
            <Route path="/" element={<HomeView />} />
            <Route path="/book/:id" element={<BookDetailsWrapper />} />
            <Route path="/search" element={<SearchView />} />
            <Route path="/advanced-search" element={<AdvancedSearchView />} />
            <Route path="/categories" element={<CategoriesView />} />
            <Route path="/authors" element={<AuthorsView />} />

            <Route element={<ProtectedRoute />}>
                <Route path="/profile" element={<ProfileView />} />
                <Route
                    element={
                        <RoleProtectedRoute
                            permission="publisher-admin"
                            unauthorizedMessage="Seu perfil não possui permissão para administrar editoras."
                        />
                    }
                >
                    <Route path="/publisher-admin" element={<PublisherAdminView />} />
                </Route>
                <Route
                    element={
                        <RoleProtectedRoute
                            permission="global-admin"
                            unauthorizedMessage="Seu perfil não possui permissão de administrador global."
                        />
                    }
                >
                    <Route path="/admin" element={<AdminView />} />
                </Route>
            </Route>
        </Routes>
    );
}
