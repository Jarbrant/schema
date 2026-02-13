/* ========================================================================
   AO-07: HOME — Startsida med gradient bakgrund & card-layout
   ======================================================================== */

/* Full-page gradient container */
.home-container {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

/* Main content card */
.home-container.view-container {
    background: white;
    color: #333;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    max-width: 1200px;
    width: 100%;
    padding: 2rem 3rem;
    display: block;
}

.home-container h2 {
    font-size: 2.2rem;
    margin-bottom: 1.5rem;
    color: #333;
    border-bottom: 3px solid #667eea;
    padding-bottom: 1rem;
}

/* Welcome section */
.welcome-section {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    border-radius: 8px;
    text-align: center;
    margin-bottom: 2rem;
}

.welcome-text {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 500;
    line-height: 1.6;
}

/* Stats Grid (3 kolumner) */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    margin-bottom: 3rem;
}

.stat-card {
    background: #f9f9f9;
    padding: 2rem;
    border-radius: 8px;
    border: 1px solid #eee;
    transition: all 0.3s ease;
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
}

.stat-card:hover {
    background: white;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.15);
    border-color: #667eea;
}

.stat-icon {
    font-size: 2.5rem;
    flex-shrink: 0;
}

.stat-content {
    flex: 1;
}

.stat-content h3 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 1.2rem;
}

.stat-value {
    margin: 0.5rem 0;
    font-size: 2rem;
    color: #667eea;
    font-weight: 700;
}

.stat-label {
    margin: 0.5rem 0 0 0;
    color: #999;
    font-size: 0.9rem;
}

/* Quick Links Section */
.quick-links {
    margin-top: 3rem;
}

.quick-links h3 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
    color: #333;
}

/* Links Grid (3 kolumner, responsive) */
.links-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1.5rem;
}

.quick-link {
    background: #f9f9f9;
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid #eee;
    text-decoration: none;
    color: #333;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.8rem;
}

.quick-link:hover {
    background: white;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
    border-color: #667eea;
    transform: translateY(-2px);
    color: #667eea;
}

.link-icon {
    font-size: 2.5rem;
}

.link-text {
    font-weight: 600;
    font-size: 0.95rem;
    color: #333;
}

.quick-link:hover .link-text {
    color: #667eea;
}

.link-desc {
    font-size: 0.8rem;
    color: #999;
    line-height: 1.3;
}

/* Info Section */
.info-section {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid #eee;
}

.info-section h3 {
    font-size: 1.2rem;
    margin-bottom: 1rem;
    color: #333;
}

.info-content {
    background: #f9f9f9;
    padding: 1.5rem;
    border-radius: 8px;
    border-left: 4px solid #667eea;
}

.info-content p {
    margin-bottom: 0.5rem;
    color: #666;
    font-size: 0.95rem;
    line-height: 1.6;
}

/* Responsive Design */
@media (max-width: 1024px) {
    .home-container.view-container {
        padding: 1.5rem 2rem;
    }

    .stats-grid {
        gap: 1.5rem;
    }

    .stat-card {
        padding: 1.5rem;
    }

    .stat-value {
        font-size: 1.8rem;
    }

    .links-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 768px) {
    .home-container {
        padding: 1rem;
    }

    .home-container.view-container {
        padding: 1.5rem;
    }

    .home-container h2 {
        font-size: 1.8rem;
    }

    .welcome-text {
        font-size: 1rem;
    }

    .stats-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    .stat-card {
        padding: 1rem;
        gap: 1rem;
    }

    .stat-icon {
        font-size: 2rem;
    }

    .stat-value {
        font-size: 1.5rem;
    }

    .links-grid {
        grid-template-columns: 1fr;
    }

    .quick-link {
        padding: 1rem;
    }

    .link-icon {
        font-size: 2rem;
    }

    .link-text {
        font-size: 0.9rem;
    }

    .link-desc {
        font-size: 0.75rem;
    }
}

@media (max-width: 480px) {
    .home-container {
        padding: 0.5rem;
    }

    .home-container.view-container {
        padding: 1rem;
    }

    .home-container h2 {
        font-size: 1.4rem;
        margin-bottom: 1rem;
    }

    .welcome-section {
        padding: 1rem;
        margin-bottom: 1.5rem;
    }

    .welcome-text {
        font-size: 0.9rem;
    }

    .stats-grid {
        gap: 0.8rem;
    }

    .stat-card {
        flex-direction: column;
        text-align: center;
        padding: 0.8rem;
    }

    .stat-icon {
        font-size: 1.8rem;
    }

    .stat-content h3 {
        font-size: 1rem;
    }

    .stat-value {
        font-size: 1.3rem;
    }

    .stat-label {
        font-size: 0.8rem;
    }

    .quick-links h3 {
        font-size: 1.2rem;
        margin-bottom: 1rem;
    }

    .link-icon {
        font-size: 1.8rem;
    }

    .link-text {
        font-size: 0.8rem;
    }

    .info-section h3 {
        font-size: 1.05rem;
    }

    .info-content {
        padding: 1rem;
    }

    .info-content p {
        font-size: 0.85rem;
    }
}
