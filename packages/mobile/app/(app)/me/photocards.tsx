import { Redirect } from 'expo-router';

/**
 * SCR-021 — 구매 포토카드. 기존 `/collection` 화면을 재사용 (rarity 필터 + view-mode
 * 토글 + 빈 상태). `/me/photocards` 는 마이페이지에서 들어오는 alias 라우트.
 */
export default function MePhotocardsScreen() {
  return <Redirect href="/(app)/collection" />;
}
