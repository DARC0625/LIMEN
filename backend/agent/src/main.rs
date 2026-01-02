use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use sysinfo::System;

// Shared state structure
struct AppState {
    sys: Mutex<System>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    uptime: u64,
}

#[derive(Serialize)]
struct MetricsResponse {
    cpu_usage: f32,
    total_memory: u64,
    used_memory: u64,
    free_memory: u64,
    cpu_cores: usize,
}

// Health check endpoint
async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        uptime: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
    })
}

// Metrics endpoint with optimized system refresh
async fn get_metrics(state: axum::extract::State<Arc<AppState>>) -> Json<MetricsResponse> {
    let mut sys = state.sys.lock().unwrap();

    // Refresh only necessary components for better performance
    sys.refresh_cpu();
    sys.refresh_memory();

    let cpu_usage = sys.global_cpu_info().cpu_usage();
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();
    let free_memory = sys.free_memory();
    let cpu_cores = sys.cpus().len();

    Json(MetricsResponse {
        cpu_usage,
        total_memory,
        used_memory,
        free_memory,
        cpu_cores,
    })
}

#[tokio::main]
async fn main() {
    // Initialize system information collector
    let mut sys = System::new_all();
    sys.refresh_all();

    let app_state = Arc::new(AppState {
        sys: Mutex::new(sys),
    });

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/metrics", get(get_metrics))
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 9000));
    println!("Agent listening on {}", addr);

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("Failed to bind to {}: {}", addr, e);
            std::process::exit(1);
        }
    };
    if let Err(e) = axum::serve(listener, app).await {
        eprintln!("Server error: {}", e);
        std::process::exit(1);
    }
}
