#!/bin/bash
# PM2 관리 명령어 스크립트

case "$1" in
  list)
    pm2 list
    ;;
  status)
    pm2 status
    ;;
  logs)
    pm2 logs "${2:-all}" --lines 50
    ;;
  restart)
    if [ -z "$2" ]; then
      pm2 restart all
    else
      pm2 restart "$2"
    fi
    ;;
  stop)
    if [ -z "$2" ]; then
      pm2 stop all
    else
      pm2 stop "$2"
    fi
    ;;
  start)
    if [ -z "$2" ]; then
      pm2 start all
    else
      pm2 start "$2"
    fi
    ;;
  limen)
    case "$2" in
      restart) pm2 restart limen-frontend ;;
      stop) pm2 stop limen-frontend ;;
      start) pm2 start limen-frontend ;;
      logs) pm2 logs limen-frontend --lines 50 ;;
      *) echo "Usage: $0 limen {restart|stop|start|logs}" ;;
    esac
    ;;
  darc)
    case "$2" in
      restart) pm2 restart darc.kr ;;
      stop) pm2 stop darc.kr ;;
      start) pm2 start darc.kr ;;
      logs) pm2 logs darc.kr --lines 50 ;;
      *) echo "Usage: $0 darc {restart|stop|start|logs}" ;;
    esac
    ;;
  *)
    echo "PM2 관리 스크립트"
    echo ""
    echo "사용법: $0 {command} [options]"
    echo ""
    echo "명령어:"
    echo "  list                    - 프로세스 목록"
    echo "  status                  - 상태 확인"
    echo "  logs [name]             - 로그 확인 (기본: all)"
    echo "  restart [name]          - 재시작 (기본: all)"
    echo "  stop [name]             - 중지 (기본: all)"
    echo "  start [name]           - 시작 (기본: all)"
    echo ""
    echo "LIMEN 전용:"
    echo "  limen restart          - LIMEN 재시작"
    echo "  limen stop             - LIMEN 중지"
    echo "  limen start            - LIMEN 시작"
    echo "  limen logs             - LIMEN 로그"
    echo ""
    echo "DARC 전용:"
    echo "  darc restart           - DARC 재시작"
    echo "  darc stop              - DARC 중지"
    echo "  darc start             - DARC 시작"
    echo "  darc logs              - DARC 로그"
    ;;
esac






