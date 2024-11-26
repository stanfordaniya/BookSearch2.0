const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Content Security Policy (CSP) headers
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' https://accounts.google.com https://cdnjs.cloudflare.com; connect-src 'self' https://www.googleapis.com"
    );
    next();
});

// Exclude favicon from triggering 404
app.get("/favicon.ico", (req, res) => res.status(204));

// Root route
app.get("/", (req, res) => {
    res.send("Welcome to the Book Search API! The server is running.");
});

// Google OAuth redirect route
app.get("/auth/google", (req, res) => {
    const redirectUri = process.env.REDIRECT_URI;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(
        "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/books"
    )}&access_type=offline&prompt=consent`;

    res.redirect(authUrl);
});

// Google OAuth callback route
app.get("/auth/callback", async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).json({ error: "Authorization code not found" });
    }

    try {
        const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", {
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.REDIRECT_URI,
            grant_type: "authorization_code",
        });

        const { access_token, refresh_token } = tokenResponse.data;

        console.log("Access Token:", access_token); // Avoid logging in production
        console.log("Refresh Token:", refresh_token); // Avoid logging in production

        // Redirect to frontend with token
        const redirectUrl = `https://stanfordaniya.github.io/BookSearch2.0/?access_token=${access_token}`;
        res.redirect(redirectUrl);
    } catch (error) {
        console.error("Error exchanging token:", error.response?.data || error.message);
        res.status(500).json({
            error: "Failed to exchange authorization code",
            details: error.response?.data || error.message,
        });
    }
});

// Token refresh route
app.post("/auth/refresh", async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({ error: "Refresh token is required" });
    }

    try {
        const response = await axios.post("https://oauth2.googleapis.com/token", {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            refresh_token: refresh_token,
            grant_type: "refresh_token",
        });

        const { access_token } = response.data;

        res.json({ access_token });
    } catch (error) {
        console.error("Error refreshing access token:", error.response?.data || error.message);
        res.status(500).json({
            error: "Failed to refresh access token",
            details: error.response?.data || error.message,
        });
    }
});

// Proxy route to fetch books from Google Books API
app.get("/api/books", async (req, res) => {
    const { query, startIndex = 0 } = req.query;

    if (!query) {
        return res.status(400).json({ error: "Query parameter is required" });
    }

    try {
        const response = await axios.get("https://www.googleapis.com/books/v1/volumes", {
            params: { q: query, startIndex, maxResults: 10 },
        });

        if (!response.data.items) {
            return res.status(404).json({ error: "No books found" });
        }

        res.json(response.data);
    } catch (error) {
        console.error("Error fetching books:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch books" });
    }
});

// Catch-all route for unhandled requests
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
