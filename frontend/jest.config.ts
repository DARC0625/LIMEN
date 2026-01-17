/**
 * Jest Main Configuration
 * 
 * 정석 원칙: Jest를 core(node) / ui(jsdom) 2프로젝트로 분리
 * - core: lib/** 테스트 (node 환경)
 * - ui: app/** 테스트 및 브라우저 의존 테스트 (jsdom 환경)
 */
import type { Config } from 'jest';
import coreConfig from './jest.core.config';
import uiConfig from './jest.ui.config';

const config: Config = {
  projects: [coreConfig, uiConfig],
};

export default config;
