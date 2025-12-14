use axum::{
    routing::get,
    Router,
    Json,
};
use serde::Serialize;
use sysinfo::{System, Networks};
use std::sync::{Arc, Mutex};
use std::net::SocketAddr;

// 공유 상태를 위한 구조체
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

#[tokio::main]
async fn main() {
    // 시스템 정보 수집기 초기화
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
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        uptime: System::uptime(),
    })
}

async fn get_metrics(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> Json<MetricsResponse> {
    let mut sys = state.sys.lock().unwrap();
    
    sys.refresh_cpu();
    sys.refresh_memory();

    // 전체 CPU 사용량 평균 계산
    let cpus = sys.cpus();
    let cpu_usage = if cpus.is_empty() {
        0.0
    } else {
        cpus.iter().map(|cpu| cpu.cpu_usage()).sum::<f32>() / cpus.len() as f32
    };

    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();

    Json(MetricsResponse {
        cpu_usage,
        total_memory,
        used_memory,
        free_memory: total_memory - used_memory,
        cpu_cores: cpus.len(),
    })
}
