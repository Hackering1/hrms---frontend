import { useState } from "react";
import { Navigate } from "react-router-dom";
import {
  ConfigProvider,
  Form,
  Input as AntInput,
  Button as AntButton,
  Typography,
  Alert,
  Space,
} from "antd";
import { LockOutlined, MailOutlined, SafetyOutlined } from "@ant-design/icons";
import { useLogin } from "../hooks/useAuth";
import { useAuthStore } from "../store/authStore";
import { loginSchema } from "../validations/authSchema";
import { classifyAuthError } from "../utils/authError";
import logo from "../assets/logo.jpg";

const { Title, Text } = Typography;

// Brand accent taken from the company logo (cyan -> sky -> indigo -> violet).
// Primary = brand sky-blue for readable buttons/links.
const BRAND_PRIMARY = "#00A8F0";
const BRAND_GRADIENT =
  "linear-gradient(150deg, #00D4F0 0%, #00A8F0 38%, #4060F0 72%, #9050F0 115%)";

const theme = {
  token: {
    colorPrimary: BRAND_PRIMARY,
    borderRadius: 10,
    fontFamily: "Inter, system-ui, sans-serif",
  },
};

export default function LoginPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleSubmit = () => {
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => {
        fieldErrors[i.path[0] as string] = i.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    login.mutate({ email, password });
  };

  const isWakingUp = login.isPending && login.failureCount > 0;
  const errorMessage = (() => {
    if (!login.isError || login.isPending) return null;
    return classifyAuthError(login.error).message;
  })();
  const buttonLabel = isWakingUp
    ? "Waking up server…"
    : login.isPending
      ? "Signing in…"
      : "Sign In";

  return (
    <ConfigProvider theme={theme}>
      <div
        style={{ display: "flex", minHeight: "100vh", background: "#f6f8f8" }}
      >
        {/* Left brand panel */}
        <div
          style={{
            display: "none",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "50%",
            padding: 48,
            color: "#fff",
            background: BRAND_GRADIENT,
            position: "relative",
            overflow: "hidden",
          }}
          className="antd-pilot-left"
        >
          <Space align="center">
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>
              TechNext HRMS
            </Text>
          </Space>

          <div>
            <Title level={2} style={{ color: "#fff", lineHeight: 1.2 }}>
              Everything your people
              <br />
              team needs, in one place.
            </Title>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 15 }}>
              Attendance, leave, documents, and letters — managed simply and
              securely for the whole company.
            </Text>
          </div>

          <Space align="center" style={{ color: "rgba(255,255,255,0.8)" }}>
            <SafetyOutlined />
            <Text style={{ color: "rgba(255,255,255,0.8)" }}>
              Secure, role-based access
            </Text>
          </Space>
        </div>

        {/* Right form panel */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "#ffffff",
          }}
        >
          <div style={{ width: "100%", maxWidth: 380 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <img
                src={logo}
                alt="TechNext"
                style={{
                  height: 160,
                  margin: "0 auto 16px",
                  display: "block",
                  objectFit: "contain",
                }}
              />
              <Title level={3} style={{ marginBottom: 4 }}>
                Welcome
              </Title>
              <Text type="secondary">Sign in to your TechNext account</Text>
            </div>

            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e9e9",
                borderRadius: 16,
                padding: 28,
                boxShadow: "0 4px 16px -8px rgba(15,23,42,0.12)",
              }}
            >
              <Form layout="vertical" onFinish={handleSubmit}>
                <Form.Item
                  label="Email"
                  validateStatus={errors.email ? "error" : ""}
                  help={errors.email}
                >
                  <AntInput
                    prefix={<MailOutlined />}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@technnext.com"
                    autoComplete="off"
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  label="Password"
                  validateStatus={errors.password ? "error" : ""}
                  help={errors.password}
                >
                  <AntInput.Password
                    prefix={<LockOutlined />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    size="large"
                  />
                </Form.Item>

                {isWakingUp && (
                  <Alert
                    style={{ marginBottom: 16 }}
                    type="warning"
                    showIcon
                    message="Server is waking up (free tier). Hang tight — retrying automatically…"
                  />
                )}

                {errorMessage && !isWakingUp && (
                  <Alert
                    style={{ marginBottom: 16 }}
                    type="error"
                    showIcon
                    message={errorMessage}
                  />
                )}

                <Form.Item style={{ marginBottom: 0 }}>
                  <AntButton
                    type="primary"
                    htmlType="submit"
                    block
                    size="large"
                    loading={login.isPending}
                  >
                    {buttonLabel}
                  </AntButton>
                </Form.Item>
              </Form>
            </div>

            <Text
              type="secondary"
              style={{
                display: "block",
                textAlign: "center",
                marginTop: 24,
                fontSize: 12,
              }}
            >
              © {new Date().getFullYear()} TechNext Technologies and Services
              Pvt Ltd
            </Text>
          </div>
        </div>

        <style>{`
          @media (min-width: 1024px) {
            .antd-pilot-left { display: flex !important; }
          }
        `}</style>
      </div>
    </ConfigProvider>
  );
}
