# YouTube Me

> Google Takeout의 YouTube 데이터를 활용하여 사용자의 YouTube 이용 패턴과 성향을 분석하는 프로젝트

## 📌 프로젝트 소개

YouTube Me는 사용자가 Google Takeout에서 내려받은 YouTube 데이터를 업로드하면,
검색 기록, 시청 기록, 구독 정보 등을 분석하여 사용자의 YouTube 이용 패턴을 파악하는 것을 목표로 한다.

현재는 데이터 분석이나 유형 분류보다 먼저,
Google Takeout 데이터를 안정적으로 가져오고 구조화하는 **데이터 수집 및 전처리 단계**를 구현하고 있다.

---

## 🎯 프로젝트 목표

최종적으로 다음과 같은 흐름을 목표로 한다.

```text
Google Takeout
      ↓
YouTube 데이터 ZIP
      ↓
ZIP Importer
      ↓
File Detector
      ↓
Data Parser
      ↓
Data Normalizer
      ↓
Topic Engine
      ↓
Behavior Analysis
      ↓
User Clustering
      ↓
YouTube 이용 유형 생성