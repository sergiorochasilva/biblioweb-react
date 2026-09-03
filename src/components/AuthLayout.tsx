import { ReactNode } from "react";
import { Card, Typography } from "antd";
import logo from "../assets/logo.png";

interface AuthLayoutProps {
    title: string;
    subtitle?: ReactNode;
    children: ReactNode;
    className?: string;
}

/**
 * Layout compartilhado das telas públicas de autenticação e acesso sensível.
 *
 * @param props Conteúdo e customizações visuais da tela.
 * @returns Estrutura centralizada com marca, título e conteúdo.
 */
export default function AuthLayout({ title, subtitle, children, className }: AuthLayoutProps) {
    return (
        <div className={`auth-page${className ? ` ${className}` : ""}`}>
            <Card className="glass-panel auth-card" bordered={false}>
                <div className="auth-logo-wrap">
                    <img src={logo} alt="Logo BiblioWeb" className="auth-logo" />
                </div>
                <div className="auth-header">
                    <Typography.Title level={2} className="auth-title">
                        {title}
                    </Typography.Title>
                    {subtitle && (
                        <Typography.Text className="auth-subtitle">{subtitle}</Typography.Text>
                    )}
                </div>
                {children}
            </Card>
        </div>
    );
}
