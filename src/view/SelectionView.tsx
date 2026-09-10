import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOutlined } from "@ant-design/icons";
import { App as AntdApp, Button, Spin, Typography } from "antd";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../contexts/useAuth";
import { api } from "../service/api";
import { getErrorMessage } from "../service/errorMessage";
import { getEligibleLibraries, sanitizeNextPath } from "../service/librarySession";
import { handlePendingLendActionAfterLogin } from "../service/postLoginAction";
import type { Library, ProfileData } from "../types";

/**
 * Tela de escolha do acervo do leitor após autenticação.
 *
 * @returns Tela de seleção obrigatória apenas para perfis com mais de um acervo.
 */
export default function SelectionView() {
    const [profileData, setProfileData] = useState<ProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isContinuing, setIsContinuing] = useState(false);
    const redirectedRef = useRef(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { getAccessToken, setLibrary, setProfile, setPublisher } = useAuth();
    const { message } = AntdApp.useApp();
    const nextPath = sanitizeNextPath(searchParams.get("next"));

    const libraries = useMemo(() => getEligibleLibraries(profileData), [profileData]);

    /**
     * Persiste o acervo escolhido e somente então retoma a ação pós-login.
     *
     * @param selectedLibrary Acervo confirmado no perfil recém-carregado.
     * @param accessToken Token válido da sessão.
     * @returns Promise<void>
     */
    const continueWithLibrary = useCallback(async (selectedLibrary: Library, accessToken: string): Promise<void> => {
        setIsContinuing(true);
        setLibrary(selectedLibrary);
        const handledPendingAction = await handlePendingLendActionAfterLogin(
            accessToken,
            navigate,
            (errorMessage) => message.error(errorMessage),
            selectedLibrary.id
        );
        if (!handledPendingAction) {
            navigate(nextPath || "/", { replace: true });
        }
    }, [message, navigate, nextPath, setLibrary]);

    useEffect(() => {
        let isActive = true;

        /**
         * Carrega os vínculos e auto-seleciona somente o único acervo elegível.
         *
         * @returns Promise<void>
         */
        const loadProfile = async (): Promise<void> => {
            const accessToken = await getAccessToken();
            if (!accessToken) {
                navigate(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`, { replace: true });
                return;
            }
            try {
                const data = await api.get<ProfileData>("/profile", accessToken);
                if (!isActive) return;
                const availableLibraries = getEligibleLibraries(data);
                setProfile(data);
                setPublisher(null);
                setProfileData(data);
                if (availableLibraries.length === 0) {
                    setLibrary(null);
                    navigate("/profile", { replace: true });
                    return;
                }
                if (availableLibraries.length === 1 && !redirectedRef.current) {
                    redirectedRef.current = true;
                    await continueWithLibrary(availableLibraries[0], accessToken);
                }
            } catch (error: unknown) {
                if (isActive) message.error(getErrorMessage(error, "Erro ao carregar seus acervos."));
            } finally {
                if (isActive) setIsLoading(false);
            }
        };
        void loadProfile();
        return () => { isActive = false; };
    }, [continueWithLibrary, getAccessToken, message, navigate, nextPath, setLibrary, setProfile, setPublisher]);

    /**
     * Seleciona o acervo pelo card e retoma o fluxo solicitado após o login.
     *
     * @param selectedLibrary Acervo acionado pelo leitor.
     * @returns Promise<void>
     */
    const selectLibrary = async (selectedLibrary: Library): Promise<void> => {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            message.error("Sua sessão expirou. Entre novamente para selecionar um acervo.");
            navigate(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`, {
                replace: true,
            });
            return;
        }
        try {
            await continueWithLibrary(selectedLibrary, accessToken);
        } catch (error: unknown) {
            message.error(getErrorMessage(error, "Não foi possível concluir a seleção."));
            setIsContinuing(false);
        }
    };

    if (isLoading) return <div className="auth-page"><Spin size="large" /></div>;

    if (libraries.length === 0) {
        return (
            <AuthLayout title="Acesso sem acervo" subtitle="Seu usuário ainda não possui um acervo habilitado.">
                <Typography.Paragraph className="auth-subtitle">Entre em contato com a biblioteca responsável para solicitar seu acesso.</Typography.Paragraph>
                <Button type="primary" block onClick={() => navigate("/profile", { replace: true })}>Ir para meu perfil</Button>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Qual acervo você quer acessar?" subtitle="Você poderá trocar de acervo pelo menu superior.">
            <div className="library-selection-grid" role="list" aria-label="Acervos disponíveis">
                {libraries.map((library) => (
                    <button
                        key={library.id}
                        type="button"
                        className="library-selection-card glass-panel"
                        onClick={() => {
                            void selectLibrary(library);
                        }}
                        disabled={isContinuing}
                        aria-label={`Selecionar acervo ${library.name}`}
                    >
                        <BookOutlined className="library-selection-card-icon" aria-hidden="true" />
                        <span className="library-selection-card-copy">
                            <strong>{library.name}</strong>
                            <span>Selecionar este acervo</span>
                        </span>
                    </button>
                ))}
            </div>
        </AuthLayout>
    );
}
