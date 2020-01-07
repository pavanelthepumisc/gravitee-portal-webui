/*
 * Copyright (C) 2015 The Gravitee team (http://gravitee.io)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Injectable } from '@angular/core';
import { ActivatedRoute, PRIMARY_OUTLET, Route, Router, Routes } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { FeatureGuardService } from './feature-guard.service';
import { AuthGuardService } from './auth-guard.service';

export interface INavRoute {
  path: string;
  title: string;
  icon?: string;
  active?: boolean;
  separator?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NavRouteService {

  constructor(private router: Router,
              private translateService: TranslateService,
              private featureGuardService: FeatureGuardService,
              private authGuardService: AuthGuardService) {
  }

  async getUserNav(): Promise<INavRoute[]> {
    const parentPath = 'user';
    const userRoute = this.getRouteByPath(parentPath);
    return this.getChildrenNav(userRoute, parentPath, []);
  }

  async getChildrenNav(aRoute: ActivatedRoute | Route, parentPath?: string, hiddenPaths?: Array<string>): Promise<INavRoute[]> {
    // @ts-ignore
    const _route: { data, pathFromRoot, routeConfig, children, path } = aRoute instanceof ActivatedRoute ? aRoute.snapshot : aRoute;

    const data = _route.data;
    if (data && data.menu) {
      const menuOptions = typeof data.menu === 'object' ? data.menu : { hiddenPaths: [] };
      const _hiddenPaths = (hiddenPaths ? hiddenPaths : menuOptions.hiddenPaths) || [];

      const _parentPath = parentPath ? parentPath : (_route.pathFromRoot || [])
        .filter((route) => route.routeConfig)
        .map((route) => route.routeConfig.path).join('/');

      const children = _route.routeConfig ? _route.routeConfig.children : _route.children;
      // @ts-ignore
      return Promise.all(children
      // @ts-ignore
        .filter((child) => child.data != null && child.data.title)
        .filter(this.isVisiblePath(_hiddenPaths))
        .filter((child) => this.featureGuardService.canActivate(child) === true)
        .map(async (child) => {
          const hasAuth = await this.authGuardService.canActivate(child);
          if (hasAuth === true) {
            const path = `${ _parentPath }/${ child.path }`;
            const active = this.router.isActive(path, false);
            return this.translateService.get(child.data.title).toPromise().then((_title) => {
              const routeNav: INavRoute = {
                path,
                icon: child.data.icon,
                title: _title,
                active,
                separator: child.data.separator
              };
              return routeNav;
            });
          }
          return null;
        }))
        .then((routes) => routes.filter((route) => route != null));
    }
    return null;
  }

  private isVisiblePath(_hiddenPaths) {
    return (child) =>  !_hiddenPaths.includes(child.path);
  }

  async getSiblingsNav(activatedRoute: ActivatedRoute): Promise<INavRoute[]> {
    const data = activatedRoute.snapshot.data;
    if (data.menu) {
      const params = activatedRoute.snapshot.params;
      const childrenNav = this.getChildrenNav(activatedRoute.parent);
      if (params) {
        // Replace dynamic path param
        return childrenNav.then((navRoutes) => {
          return navRoutes.map((navRoute) => {
            for (const key of Object.keys(params)) {
              navRoute.path = navRoute.path.replace(`:${ key }`, params[key]);
              navRoute.active = this.router.isActive(navRoute.path, true);
            }
            return navRoute;
          });
        });
      }
      return childrenNav;
    }
    return null;
  }

  findCurrentRoute(activatedRoute: ActivatedRoute) {
    let route = activatedRoute.firstChild;
    let child = route;

    while (child) {
      if (child.firstChild) {
        child = child.firstChild;
        route = child;
      } else {
        child = null;
      }
    }
    return route;
  }

  getRouteByPath(path: string) {
    return this._getRouteByPath(this.router.config, path);
  }

  _getRouteByPath(children: Routes, path: string) {
    if (children) {
      const found = children.find((route) => route.path === path);
      if (found == null) {
        return children.map((route) => this._getRouteByPath(route.children, path))
          .find((route) => route && route.path === path);
      }
      return found;
    }
    return null;
  }

  getBreadcrumbs(route: ActivatedRoute, url: string = '', breadcrumbs: INavRoute[] = []): Promise<INavRoute[]> {
    const ROUTE_DATA_BREADCRUMB = 'breadcrumb';

    const children: ActivatedRoute[] = route.children;

    if (children.length === 0) {
      // @ts-ignore
      return breadcrumbs;
    }

    for (const child of children) {
      if (child.outlet !== PRIMARY_OUTLET) {
        continue;
      }

      if (!child.snapshot.data.hasOwnProperty(ROUTE_DATA_BREADCRUMB)) {
        return this.getBreadcrumbs(child, url, breadcrumbs);
      }

      if (child.snapshot.data[ROUTE_DATA_BREADCRUMB] === true) {
        const routeURL: string = child.snapshot.url.map(segment => segment.path).join('/');
        url += `/${ routeURL }`;

        const breadcrumb = this.translateService.get(child.snapshot.data.title)
          .toPromise()
          .then((_title) => ({ title: _title, path: url }));
        // @ts-ignore
        breadcrumbs.push(breadcrumb);
      }
      return this.getBreadcrumbs(child, url, breadcrumbs);
    }
  }

}