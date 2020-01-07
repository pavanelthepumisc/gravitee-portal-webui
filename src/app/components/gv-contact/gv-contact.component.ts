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
import { AfterViewInit, Component, Input, OnInit } from '@angular/core';
import { ApiService, ApplicationsService, PortalService, User } from '@gravitee/ng-portal-webclient';
import { NotificationService } from '../../services/notification.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { LoaderService } from '../../services/loader.service';
import { CurrentUserService } from '../../services/current-user.service';
import { delay } from 'rxjs/operators';
import { marker as i18n } from '@biesbjerg/ngx-translate-extract-marker';

@Component({
  selector: 'app-gv-contact',
  templateUrl: './gv-contact.component.html',
  styleUrls: ['./gv-contact.component.css']
})
export class GvContactComponent implements OnInit, AfterViewInit {

  @Input() apiId: string;

  contactForm: FormGroup;
  applications: {
    label: string,
    value: string,
  }[];
  apis: {
    label: string,
    value: string,
  }[];

  constructor(
    private applicationsService: ApplicationsService,
    private apiService: ApiService,
    private portalService: PortalService,
    private formBuilder: FormBuilder,
    private notificationService: NotificationService,
    public loaderService: LoaderService,
    private currentUserService: CurrentUserService,
  ) {
  }

  ngOnInit(): void {
    this.initFormGroup();
    this.applicationsService.getApplications({ size: 100 })
      .subscribe((response) => {
        this.applications = response.data.map(application => {
          return { label: `${ application.name } (${ application.owner.display_name })`, value: application.id };
        });
      });
    this.apiService.getApis({ size: 100 })
      .subscribe((response) => {
        this.apis = response.data.map(api => {
          return { label: `${ api.name } (${ api.version })`, value: api.id };
        });
      });
  }

  ngAfterViewInit() {
    this.currentUserService.get().pipe(delay(0)).subscribe(value => {
      if (value && !value.email) {
        this.notificationService.warning(i18n('errors.email.required'));
        this.contactForm.disable();
      }
    });
  }

  initFormGroup() {
    this.contactForm = this.formBuilder.group({
      api: this.apiId || null,
      application: null,
      subject: '',
      content: '',
      copy_to_sender: false,
    });
  }

  submit() {
    if (!this.loaderService.get()) {
      this.portalService.createTicket({ TicketInput: this.contactForm.value }).subscribe(() => {
        this.notificationService.success(i18n('gv-contact.success'));
        this.initFormGroup();
      });
    }
  }
}