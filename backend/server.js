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
        "default-src 'self'; img-src 'self' data: https:; script-src 'self' https://accounts.google.com https://cdnjs.cloudflare.com"
    );
    next();
});

// Root route
app.get("/", (req, res) => {
    res.send("Welcome to the Book Search API! The server is running.");
});

// Google OAuth redirect route
app.get("/auth/google", (req, res) => {
    const redirectUri = process.env.REDIRECT_URI;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile`;
    res.redirect(authUrl);
});

// Exchange authorization code for access token
app.post("/auth/token", async (req, res) => {
    try {
        const { code } = req.body;
        const response = await axios.post("https://oauth2.googleapis.com/token", {
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: process.env.REDIRECT_URI,
            grant_type: "authorization_code",
        });
        res.json(response.data);
    } catch (error) {
        console.error("Error exchanging token:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to exchange token" });
    }
});

// Proxy route to fetch books from Google Books API
app.get("/api/books", async (req, res) => {
    const { query, startIndex } = req.query;

    try {
        const response = await axios.get("https://www.googleapis.com/books/v1/volumes", {
            params: {
                q: query,
                startIndex,
                maxResults: 10, // Adjust as needed
            },
            headers: { Authorization: `Bearer ${req.headers.authorization}` },
        });
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching books:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch books" });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
