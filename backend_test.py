import requests
import sys
import json
from datetime import datetime

class BioinformaticsAPITester:
    def __init__(self, base_url="https://diagstat-app.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"Response: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"Error response: {json.dumps(error_data, indent=2, ensure_ascii=False)}")
                except:
                    print(f"Error response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )

    def test_create_experiment(self):
        """Test creating a new experiment with sample data"""
        experiment_data = {
            "experiment_name": "การเปรียบเทียบ qPCR vs RPA",
            "description": "การทดสอบประสิทธิภาพของเทคนิค qPCR และ RPA",
            "techniques": [
                {
                    "technique_name": "qPCR",
                    "matrix": {
                        "true_positive": 85,
                        "false_positive": 5,
                        "true_negative": 90,
                        "false_negative": 10
                    },
                    "confidence_level": 0.95
                },
                {
                    "technique_name": "RPA",
                    "matrix": {
                        "true_positive": 80,
                        "false_positive": 8,
                        "true_negative": 87,
                        "false_negative": 15
                    },
                    "confidence_level": 0.95
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Experiment",
            "POST",
            "experiments",
            200,
            data=experiment_data
        )
        
        if success and response:
            # Validate response structure
            required_fields = ['id', 'experiment_name', 'techniques_results', 'comparison_summary']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing required field: {field}")
                    return False, {}
            
            # Validate techniques results
            if len(response['techniques_results']) != 2:
                print(f"❌ Expected 2 technique results, got {len(response['techniques_results'])}")
                return False, {}
            
            # Validate statistical calculations
            for tech_result in response['techniques_results']:
                stats = tech_result['stats']
                required_stats = ['sensitivity', 'specificity', 'ppv', 'npv', 'accuracy']
                for stat in required_stats:
                    if stat not in stats:
                        print(f"❌ Missing statistic: {stat}")
                        return False, {}
                    if not (0 <= stats[stat] <= 1):
                        print(f"❌ Invalid {stat} value: {stats[stat]} (should be between 0 and 1)")
                        return False, {}
            
            print("✅ Experiment creation and calculations validated successfully")
            return True, response
        
        return False, {}

    def test_get_experiments(self):
        """Test getting all experiments"""
        return self.run_test(
            "Get All Experiments",
            "GET",
            "experiments",
            200
        )

    def test_invalid_experiment(self):
        """Test creating experiment with invalid data"""
        invalid_data = {
            "experiment_name": "",  # Empty name
            "techniques": [
                {
                    "technique_name": "qPCR",
                    "matrix": {
                        "true_positive": -1,  # Invalid negative value
                        "false_positive": 5,
                        "true_negative": 90,
                        "false_negative": 10
                    }
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Invalid Experiment",
            "POST",
            "experiments",
            422,  # Validation error
            data=invalid_data
        )
        
        if not success and response:
            print("✅ Validation error handled correctly")
            return True, response
        return success, response

    def test_single_technique_experiment(self):
        """Test creating experiment with only one technique (should fail)"""
        single_tech_data = {
            "experiment_name": "Single Technique Test",
            "techniques": [
                {
                    "technique_name": "qPCR",
                    "matrix": {
                        "true_positive": 85,
                        "false_positive": 5,
                        "true_negative": 90,
                        "false_negative": 10
                    }
                }
            ]
        }
        
        success, response = self.run_test(
            "Create Single Technique Experiment",
            "POST",
            "experiments",
            422,  # Should fail validation
            data=single_tech_data
        )
        
        if not success:
            print("✅ Single technique validation working correctly")
            return True, response
        return False, {}

    def test_confidence_levels(self):
        """Test different confidence levels"""
        for confidence_level in [0.90, 0.95, 0.99]:
            experiment_data = {
                "experiment_name": f"Test Confidence {confidence_level}",
                "techniques": [
                    {
                        "technique_name": "qPCR",
                        "matrix": {
                            "true_positive": 85,
                            "false_positive": 5,
                            "true_negative": 90,
                            "false_negative": 10
                        },
                        "confidence_level": confidence_level
                    },
                    {
                        "technique_name": "RPA",
                        "matrix": {
                            "true_positive": 80,
                            "false_positive": 8,
                            "true_negative": 87,
                            "false_negative": 15
                        },
                        "confidence_level": confidence_level
                    }
                ]
            }
            
            success, response = self.run_test(
                f"Test Confidence Level {confidence_level}",
                "POST",
                "experiments",
                200,
                data=experiment_data
            )
            
            if not success:
                return False, {}
        
        print("✅ All confidence levels tested successfully")
        return True, {}

def main():
    print("🧬 Starting Bioinformatics API Testing...")
    print("=" * 60)
    
    tester = BioinformaticsAPITester()
    
    # Test sequence
    tests = [
        tester.test_root_endpoint,
        tester.test_create_experiment,
        tester.test_get_experiments,
        tester.test_confidence_levels,
        tester.test_invalid_experiment,
        tester.test_single_technique_experiment,
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())