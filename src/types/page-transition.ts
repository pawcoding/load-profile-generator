export interface PageTransition {
  entries: number;
  exits: number;
  loops: number;
  otherNavigations: number;
  followingPages: Array<FollowingPage>;
}

export interface FollowingPage {
  id?: number;
  label: string;
  navigations: number;
}
