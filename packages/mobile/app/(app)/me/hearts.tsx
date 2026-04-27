import { Redirect } from 'expo-router';

/**
 * SCR-024 alias — `/me/hearts` 는 `/me/follows` 와 같은 통합 탭 화면. 하트 탭이
 * default 가 아닌 follows tab 으로 시작하지만, deep-link 일관성을 위해 별도
 * 라우트 노출.
 */
export default function MeHeartsScreen() {
  return <Redirect href="/(app)/me/follows" />;
}
