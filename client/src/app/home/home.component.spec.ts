import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule, FormsModule],
      declarations: [HomeComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('loads presets, health and an initial match on init', () => {
    http.expectOne(r => r.url.endsWith('/api/rfqs')).flush([]);
    http.expectOne(r => r.url.endsWith('/api/health')).flush({ smeProfiles: 0, embedding: { ready: true }, claude: { configured: false, model: 'claude-opus-5-5' } });
    http.expectOne(r => r.url.endsWith('/api/match')).flush({ matches: [], totalEvaluated: 0, eligibleCount: 0, engine: { semantic: 'hybrid-embedding', dimensions: 384 } });
    expect(component.isLoadingMatches).toBeFalse();
    expect(component.matchError).toBeNull();
  });

  it('shows an error state when the matching service is unreachable', () => {
    http.expectOne(r => r.url.endsWith('/api/rfqs')).flush([]);
    http.expectOne(r => r.url.endsWith('/api/health')).error(new ProgressEvent('error'));
    http.expectOne(r => r.url.endsWith('/api/match')).error(new ProgressEvent('error'), { status: 0 });
    expect(component.matchError).toContain('not reachable');
  });

  it('blocks submission with field errors', () => {
    http.match(() => true).forEach(r => r.flush({ matches: [] }));
    component.rfqText = '';
    component.budgetZAR = 0;
    component.submitProcurementRequest();
    expect(component.errorCount).toBe(2);
    expect(component.isSubmitting).toBeFalse();
  });

  it('sends the ticked mandatory checks with the request', () => {
    http.match(() => true).forEach(r => r.flush({ matches: [] }));
    component.requireCipc = true;
    component.requireTaxPin = false;
    component.requireYouthOwned = true;
    component.requireCoida = true;
    expect(component.complianceRequirements).toEqual(['cipcRegistered', 'youthOwned', 'coidaRegistered']);
  });
});
