/**
 * Integration tests: POST /api/auth/register y POST /api/auth/login.
 * Requiere DATABASE_URL (o .env.test) apuntando a una base de datos de prueba.
 */
import request from "supertest";
import { app, prisma } from "../src/server.js";
const base = "/api/auth";
const unique = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const validUser = {
    email: `${unique}@test.com`,
    username: `user_${unique}`,
    fullName: "Test User",
    password: "Password123",
    confirmPassword: "Password123",
    acceptsMarketing: false,
};
describe("POST /register", () => {
    it("Caso Éxito: datos válidos -> status 201 y usuario en body", async () => {
        const res = await request(app)
            .post(`${base}/register`)
            .send(validUser)
            .set("Content-Type", "application/json");
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("message", "User successfully registered");
        expect(res.body).toHaveProperty("user");
        expect(res.body.user).toHaveProperty("id");
        expect(res.body.user).toHaveProperty("email", validUser.email);
        expect(res.body.user).toHaveProperty("username", validUser.username);
        expect(res.body.user).not.toHaveProperty("password_hash");
    });
    it("Caso Error: email duplicado -> status 400", async () => {
        const res = await request(app)
            .post(`${base}/register`)
            .send(validUser)
            .set("Content-Type", "application/json");
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty("error");
        expect(String(res.body.error)).toMatch(/already exists|email|username/i);
    });
});
describe("POST /login", () => {
    beforeAll(async () => {
        await prisma.users.updateMany({
            where: { email: validUser.email },
            data: { isVerified: true },
        });
    });
    it("Caso Éxito: credenciales correctas -> status 200 y token JWT", async () => {
        const res = await request(app)
            .post(`${base}/login`)
            .send({ email: validUser.email, password: validUser.password })
            .set("Content-Type", "application/json");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("token");
        expect(typeof res.body.token).toBe("string");
        expect(res.body.token.length).toBeGreaterThan(0);
        expect(res.body).toHaveProperty("user");
    });
    it("Caso Error: contraseña incorrecta -> status 401", async () => {
        const res = await request(app)
            .post(`${base}/login`)
            .send({ email: validUser.email, password: "WrongPassword1" })
            .set("Content-Type", "application/json");
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty("error", "Invalid credentials");
    });
    it("Caso Error: email no registrado -> status 401", async () => {
        const res = await request(app)
            .post(`${base}/login`)
            .send({ email: "noexiste@test.com", password: "Password123" })
            .set("Content-Type", "application/json");
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty("error", "Invalid credentials");
    });
});
afterAll(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=auth.test.js.map