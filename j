pipeline {
  agent any 
  
  options {
        ansiColor('xterm')
    }
  
  tools {
    maven 'm3-2-5'
  }
  
  environment {
    Snyk = 'Snyk'
    Trivy = 'Trivy'
    Audit = 'Audit'
  }
  
  stages {
    stage ('Initialize') {
      steps {
        sh '''
                    echo "PATH = ${PATH}"
                    echo "M2_HOME = ${M2_HOME}"
            ''' 
      }
    } 
    
   stage ('Check-Git-Secrets') {
      steps {
        sh 'sshpass -p $$$ ssh devuser@10.109.137.30 "sudo docker run raphaelareya/gitleaks:latest -r https://github.com/abhi3780/webapp.git " '
        // sh 'sshpass -p $$$ ssh devuser@10.109.137.30 "exit 0" '
      }
    }     
    
   stage ('SCA') {      
    parallel {
        stage ('Snyk'){
          
      /*    when {
          environment ignoreCase: true, name: 'Snyk', value: 'Snyk'  
          }   */
          
          steps {
    // snykSecurity failOnIssues: false, monitorProjectOnBuild: false, organisation: 'Demo', snykInstallation: 'snyk', snykTokenId: 'Snyk_27May_1015PM', targetFile: 'package'
       snykSecurity organisation: 'e.vabhilash', projectName: 'abhi3780/webapp', snykInstallation: 'snyk', snykTokenId: 'Snyk_27May_1015PM'
      }
    }
     stage ('Trivy - Git repo scan'){
       
             /*    when {
          environment ignoreCase: true, name: 'Trivy', value: 'no'   
          }   */
       
       steps {
         sh 'sshpass -p $$$ ssh devuser@10.109.137.30 "docker run aquasec/trivy:0.18.3 repo https://github.com/abhi3780/trivy-ci-test" '
       }
     }
  }    
}
 
   stage ('SAST Scan') {
     parallel {
       stage ('IBM App Scan Source') {
         steps {
       appscan application: 'cb595860-1142-4fb9-95cb-eee3d7a0f33e', credentials: 'd4749e0b-a502-42a6-abe6-c9bab6b925ca', name: 'cb595860-1142-4fb9-95cb-eee3d7a0f33e1475', scanner: static_analyzer(hasOptions: false, target: '/var/jenkins_home/workspace/webgoat_pipeline'), type: 'Static Analyzer'
      } 
    }
      stage ('Trivy - Image Scan') {
            steps {
              sh 'sshpass -p $$$ ssh devuser@10.109.137.30 "docker run aquasec/trivy:0.18.3 image vulnerables/web-dvwa:latest" '
    }
   }
   
  /*   stage ('Qualys - Image Scan') {
          steps {
   getImageVulnsFromQualys apiServer: 'https://qualysapi.qualys.com', credentialsId: 'Qualys', imageIds: 'vulnerables/web-dvwa:latest,', pollingInterval: '30', proxyCredentialsId: 'Qualys', proxyPort: 9080, proxyServer: 'aiproxy.appl.chrysler.com', useLocalConfig: true, useProxy: true, vulnsTimeout: '600'
     }
    }  */
  
  }  
} 
     
   stage ('Build') {
      steps {
      sh 'mvn clean package -X'
      sh 'ls /var/jenkins_home/workspace/webapp/target'
     }
    }
   
    stage ('Artifact Analysis - Trivy') {
        parallel {
          stage ('Jenkins Container Scan') {
            steps {
              sh 'sshpass -p $$$ ssh devuser@10.109.137.30 "docker run aquasec/trivy:0.18.3 jenkins/jenkins:lts" '
          //  sh 'sshpass -p $$$ ssh devuser@10.109.137.30 "docker run aquasec/trivy:0.18.3 -o report.html jenkins/jenkins:lts" '
          }
        }  
          stage ('Tomcat Container Scan') {
            steps {
              sh 'sshpass -p $$$ ssh devuser@10.109.137.30 "docker run aquasec/trivy:0.18.3 tomcat:latest" '
              }
             }
          stage ('Audit - Docker Bench') {
          
         /*   when {
          environment ignoreCase: true, name: 'Audit', value: 'no'   
          }    */
          
           steps {
             sh 'sshpass -p $$$ ssh devuser@10.109.137.30 "cd ~/docker-bench-security/; ./docker-bench-security.sh" '
             sh 'sshpass -p $$$ ssh devuser@10.109.137.30 "exit 0" '
        } 
       } 
  }
 }

    stage ('Deploy') {
     steps {
     sh 'sshpass -p $$$ ssh devuser@10.109.137.30 "sudo docker cp /var/lib/docker/volumes/d39ec24666c4194ae2555d6b5e7f277a4886cc0876baa53ed51e6bc31cf42fdd/_data/workspace/webapp_pipeline/target/WebApp 990e2927aada4fcfb171d827744e87fec4ee7e7a3827744342e01f5c7678a3d5:/usr/local/tomcat/webapps" '
     
  // Volume is  the Jenkins Volume ID and Tomacat's Container ID
  
     sh 'echo -- BROWSE -- http://10.109.137.30:80/WebApp/'
       }
    }

    stage ('DAST Scan') {
      parallel {
        stage ('Arachni') {
      steps {
         sh 'sshpass -p $$$ ssh devuser@10.109.137.30 "sudo docker exec c2406913789c52e3dc69b680b93f60dc97d64b825f0948f2afbe2a9c95a61678 bash /arachni/bin/./arachni http://10.109.137.30:8000/WebApp/" '
         sh 'echo REPORTS SAVED in /arachni Folder'
        }
    }
      stage ('IBMApp Scan Dynamic') {
      steps {
       appscan application: 'cb595860-1142-4fb9-95cb-eee3d7a0f33e', credentials: 'd4749e0b-a502-42a6-abe6-c9bab6b925ca', name: 'cb595860-1142-4fb9-95cb-eee3d7a0f33e1864', scanner: dynamic_analyzer(hasOptions: false, optimization: 'Fast', scanType: 'Staging', target: 'http://altoromutual.com:8080/login.jsp'), type: 'Dynamic Analyzer'
     } 
    }  
   }
  }
    stage ('Infra Scan') {
       parallel {
        stage ('OpenVAS') {
          steps {
            sh 'echo https://10.109.137.30/omp?cmd=get_tasks&token=a96dba21-5731-4e03-a0c1-f2f6320187d3'
           }
         }
       stage ('QualysGuard') {
           steps {
    
      qualysVulnerabilityAnalyzer apiServer: ' https://qualysapi.qualys.com', credsId: 'Qualys', hostIp: '10.109.137.30', network: 'ACCESS_FORBIDDEN', optionProfile: 'Stellantis Full Scan', platform: 'US_PLATFORM_1', pollingInterval: '2', proxyCredentialsId: 'Qualys', proxyPort: 9080, proxyServer: 'aiproxy.appl.chrysler.com', scanName: 'Test123', scannerName: 'N_AZURE_1', useHost: true, useProxy: true, vulnsTimeout: '60*100000' 
    
    }
        } 
     }
   }
   
       stage ('Health') {
       parallel {
       
        stage ('Jenkins|Monitor') {
          steps {
            sh 'echo http://10.109.137.30:8080/monitoring'
           }
         }
         
         stage ('Splunk') {
           steps {
           sh 'echo https://shcspsp02.shdc.chrysler.com:8443/en-US/app/splunk_app_jenkins/build'
         }
        } 
        
       stage ('Notification-Hangouts') {
           steps {
            hangoutsNotify message: "The Build was Success !!!",token: "5Q0YJlSzAaRfDC9cbzHvYTZNp",threadByJob: false
            }
        } 
     }
   }
   
    
  }
} 



